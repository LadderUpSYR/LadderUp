import { useState, useRef, useEffect } from 'react';

export default function AudioTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('Ready');
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      // Connect WebSocket
      wsRef.current = new WebSocket('ws://localhost:5000/audio');
      
      wsRef.current.onopen = () => {
        setStatus('Connected');
      };
      
      wsRef.current.onmessage = (event) => {
        // Append transcription text
        setTranscript(prev => prev + ' ' + event.data);
      };
      
      wsRef.current.onerror = () => {
        setStatus('Connection error');
      };
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true
        } 
      });
      
      streamRef.current = stream;
      
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create processor to capture audio
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert float32 to int16
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // Send to server
          wsRef.current.send(int16Data.buffer);
        }
      };
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      setStatus('Recording...');
      
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setIsRecording(false);
    setStatus('Stopped');
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Real-time Audio Transcription</h1>
        
        <div className="mb-4">
          <span className="text-sm text-gray-600">Status: </span>
          <span className="font-semibold">{status}</span>
        </div>
        
        <div className="mb-6">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold"
            >
              Stop Recording
            </button>
          )}
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 min-h-[200px]">
          <h2 className="text-lg font-semibold mb-2">Transcript:</h2>
          <p className="text-gray-800 whitespace-pre-wrap">
            {transcript || 'Waiting for audio...'}
          </p>
        </div>
      </div>
    </div>
  );
}