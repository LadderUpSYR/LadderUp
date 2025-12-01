import { useState, useRef, useCallback, useEffect } from 'react';
import { getWebSocketURL } from '../utils/websocketUrl';

/**
 * Custom hook for capturing audio in practice mode using Whisper STT via WebSocket
 * Provides real-time transcription and audio recording capabilities
 * Uses backend Whisper model for superior filler word preservation
 * 
 * FILLER WORD DETECTION:
 * - Backend Whisper STT naturally preserves filler words (um, uh, er, ah, like, etc.)
 * - Much more accurate than browser-based Web Speech API
 */
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
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  /**
   * Initialize WebSocket connection for practice mode STT
   */
  const initializeWebSocket = useCallback(() => {
    return new Promise((resolve, reject) => {
      try {
        // Connect to practice mode WebSocket endpoint
        const ws = new WebSocket(getWebSocketURL('/ws/practice', 8000));
        
        ws.onopen = () => {
          console.log('Practice mode WebSocket connected');
          setAudioError(null);
          resolve(ws);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
            
            if (data.type === 'transcription') {
              // Update transcript with Whisper STT results
              setTranscript(prev => prev + data.text + ' ');
              console.log('Transcription updated:', data.text);
            } else if (data.type === 'interim') {
              // Show interim results if available
              setInterimTranscript(data.text);
            } else if (data.type === 'status') {
              console.log('Status message:', data.message);
            } else if (data.type === 'connected') {
              console.log('Connected to practice mode STT');
            } else if (data.error) {
              console.error('WebSocket error:', data.error);
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
   * Start recording audio and streaming to backend for Whisper STT
   */
  const startRecording = useCallback(async () => {
    try {
      setAudioError(null);
      
      // Initialize WebSocket connection
      await initializeWebSocket();

      // Get microphone access with optimized settings for speech
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Additional constraints for better quality
          latency: 0,
          volume: 1.0
        } 
      });
      
      streamRef.current = stream;
      
      // Create audio context for processing
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      // Load AudioWorklet module
      try {
        await audioContextRef.current.audioWorklet.addModule('/audio-processor.js');
        console.log('AudioWorklet module loaded successfully');
      } catch (error) {
        console.error('Failed to load AudioWorklet module:', error);
        // Fall back to connecting directly if AudioWorklet fails
        throw new Error('AudioWorklet not supported or failed to load');
      }
      
      // Create audio worklet node
      const source = audioContextRef.current.createMediaStreamSource(stream);
      audioWorkletRef.current = new AudioWorkletNode(
        audioContextRef.current,
        'audio-capture-processor'
      );
      
      console.log('AudioWorklet node created');
      
      // Handle messages from the audio worklet (audio data)
      audioWorkletRef.current.port.onmessage = (event) => {
        // Only send if WebSocket is still open
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          // Send binary audio data to server for Whisper STT
          websocketRef.current.send(event.data);
        }
      };
      
      // Connect the audio pipeline
      source.connect(audioWorkletRef.current);
      audioWorkletRef.current.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      
      // Notify server that audio started
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: 'start_audio' }));
      }
      
      console.log('Practice audio recording started');
      
    } catch (err) {
      console.error('Error starting audio capture:', err);
      setAudioError(err.message || 'Failed to start audio recording');
      stopRecording();
    }
  }, [initializeWebSocket]);

  /**
   * Stop recording and clean up resources
   */
  const stopRecording = useCallback(() => {
    // Stop audio worklet
    if (audioWorkletRef.current) {
      try {
        audioWorkletRef.current.disconnect();
        audioWorkletRef.current.port.onmessage = null;
      } catch (e) {
        console.warn('Error disconnecting audio worklet:', e);
      }
      audioWorkletRef.current = null;
    }

    // Stop audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Notify server that audio stopped
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      try {
        websocketRef.current.send(JSON.stringify({ type: 'stop_audio' }));
      } catch (e) {
        console.warn('Error sending stop_audio:', e);
      }
    }

    // Close WebSocket
    if (websocketRef.current) {
      try {
        websocketRef.current.close();
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
      websocketRef.current = null;
    }

    setIsRecording(false);
    setInterimTranscript('');
    console.log('Practice audio recording stopped');
  }, []);

  /**
   * Toggle recording on/off
   */
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  /**
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  /**
   * Reset transcript while recording (clear and continue)
   */
  const resetWhileRecording = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    
    // Notify server to reset transcription buffer
    if (isRecording && websocketRef.current?.readyState === WebSocket.OPEN) {
      try {
        websocketRef.current.send(JSON.stringify({ type: 'reset_transcript' }));
      } catch (err) {
        console.warn('Error sending reset_transcript:', err);
      }
    }
  }, [isRecording]);

  /**
   * Get audio blob (not needed for STT, but available for future use)
   */
  const getAudioBlob = useCallback(() => {
    // Not implemented in this version as Whisper STT handles audio directly
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
