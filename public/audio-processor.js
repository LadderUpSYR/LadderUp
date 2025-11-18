/**
 * AudioWorklet Processor for capturing and converting audio data
 * Converts Float32 audio to Int16 for WebSocket transmission
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Only process if we have input data
    if (input && input[0]) {
      const inputData = input[0]; // First channel
      
      // Convert float32 to int16 for efficient transmission
      const int16Data = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        // Clamp values to int16 range
        const clampedValue = Math.max(-1, Math.min(1, inputData[i]));
        int16Data[i] = clampedValue * 32767;
      }
      
      // Send the audio data to the main thread
      this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
    }
    
    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
