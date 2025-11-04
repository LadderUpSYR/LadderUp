import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for capturing and streaming audio through WebSocket
 * Captures microphone input and sends it as binary data for STT processing
 */
export function useAudioCapture(websocketRef) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioError, setAudioError] = useState(null);
  
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  /**
   * Start capturing audio from microphone and streaming to WebSocket
   */
  const startRecording = useCallback(async () => {
    try {
      setAudioError(null);
      
      // Check if WebSocket is available
      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket connection not available');
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create processor to capture audio chunks
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        // Only send if WebSocket is still open
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert float32 to int16 for efficient transmission
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            // Clamp values to int16 range
            const clampedValue = Math.max(-1, Math.min(1, inputData[i]));
            int16Data[i] = clampedValue * 32767;
          }
          
          // Send binary audio data to server
          websocketRef.current.send(int16Data.buffer);
        }
      };
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      
      // Notify server that audio started
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: 'start_audio' }));
      }
      
      console.log('Audio recording started');
      
    } catch (err) {
      console.error('Error starting audio capture:', err);
      setAudioError(err.message);
      
      // Clean up on error
      stopRecording();
    }
  }, [websocketRef]);

  /**
   * Stop capturing audio and clean up resources
   */
  const stopRecording = useCallback(() => {
    // Notify server that audio stopped
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ type: 'stop_audio' }));
    }
    
    // Disconnect audio processor
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {
        console.warn('Error disconnecting processor:', e);
      }
      processorRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }
    
    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    console.log('Audio recording stopped');
  }, [websocketRef]);

  /**
   * Toggle recording state
   */
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    audioError,
    startRecording,
    stopRecording,
    toggleRecording
  };
}