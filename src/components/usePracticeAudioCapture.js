import { useState, useRef, useCallback, useEffect } from 'react';

// DIRECT CLOUD RUN ENDPOINT
const HARDCODED_URL = "wss://practice-service-929812005686.us-central1.run.app/ws/practice";

export function usePracticeAudioCapture() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioError, setAudioError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioWorkletRef = useRef(null);
  const streamRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Check browser support on mount
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      setAudioError('Microphone access not supported in this browser.');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Force close on unmount
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  const initializeWebSocket = useCallback(() => {
    return new Promise((resolve, reject) => {
      try {
        console.log("Connecting to Practice STT via direct URL:", HARDCODED_URL);
        const ws = new WebSocket(HARDCODED_URL);
        
        ws.onopen = () => {
          console.log('Practice mode WebSocket connected');
          setAudioError(null);
          resolve(ws);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'transcription') {
              console.log('📝 New Transcript:', data.text);
              setTranscript(prev => prev + data.text + ' ');
            } else if (data.type === 'interim') {
              setInterimTranscript(data.text);
            } else if (data.type === 'status') {
              console.log('🔌 Status:', data.message);
            } else if (data.type === 'connected') {
              console.log('✅ Connected to practice mode STT');
            } else if (data.error) {
              console.error('❌ WebSocket error message:', data.error);
              setAudioError(data.error);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setAudioError('Connection error. Please try again.');
          reject(error);
        };

        ws.onclose = () => {
          console.log('Practice mode WebSocket closed');
          websocketRef.current = null;
        };

        websocketRef.current = ws;
      } catch (err) {
        console.error('Error initializing WebSocket:', err);
        reject(err);
      }
    });
  }, []);

  /**
   * Stop recording and clean up resources
   * MOVED UP: Must be defined BEFORE startRecording
   */
  const stopRecording = useCallback(() => {
    console.log("Stopping recording...");

    // 1. Stop Audio Processing immediately
    if (audioWorkletRef.current) {
      try {
        audioWorkletRef.current.disconnect();
        audioWorkletRef.current.port.onmessage = null;
      } catch (e) { console.warn(e); }
      audioWorkletRef.current = null;
    }

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { console.warn(e); }
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 2. Tell Server we stopped
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      try {
        console.log("Sending stop_audio signal to server...");
        websocketRef.current.send(JSON.stringify({ type: 'stop_audio' }));
      } catch (e) {
        console.warn('Error sending stop_audio:', e);
      }
    }

    // 3. DELAYED CLOSE (The Fix)
    // Give the server 2 seconds to process the final audio buffer and send text back
    // before we sever the connection.
    setTimeout(() => {
      if (websocketRef.current) {
        console.log("Closing WebSocket connection (timeout reached)");
        websocketRef.current.close();
        websocketRef.current = null;
      }
    }, 2000);

    setIsRecording(false);
    setInterimTranscript('');
  }, []);

  /**
   * Start recording audio and streaming to backend for Whisper STT
   */
  const startRecording = useCallback(async () => {
    try {
      setAudioError(null);
      await initializeWebSocket();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      try {
        // Ensure this file exists in your public folder!
        await audioContextRef.current.audioWorklet.addModule('/audio-processor.js');
      } catch (error) {
        console.error('Failed to load AudioWorklet module:', error);
        throw new Error('AudioWorklet not supported or failed to load');
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      audioWorkletRef.current = new AudioWorkletNode(
        audioContextRef.current,
        'audio-capture-processor'
      );
      
      audioWorkletRef.current.port.onmessage = (event) => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(event.data);
        }
      };
      
      source.connect(audioWorkletRef.current);
      audioWorkletRef.current.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: 'start_audio' }));
      }
      
      console.log('Practice audio recording started');
      
    } catch (err) {
      console.error('Error starting audio capture:', err);
      setAudioError(err.message || 'Failed to start audio recording');
      stopRecording();
    }
  }, [initializeWebSocket, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const resetWhileRecording = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    if (isRecording && websocketRef.current?.readyState === WebSocket.OPEN) {
      try {
        websocketRef.current.send(JSON.stringify({ type: 'reset_transcript' }));
      } catch (err) {
        console.warn('Error sending reset_transcript:', err);
      }
    }
  }, [isRecording]);

  const getAudioBlob = useCallback(() => {
    return null;
  }, []);

  return {
    isRecording,
    transcript,
    interimTranscript,
    audioError,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording,
    clearTranscript,
    resetWhileRecording,
    getAudioBlob
  };
}