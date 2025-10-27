from quart import Quart, websocket
import asyncio
import numpy as np
from faster_whisper import WhisperModel

app = Quart(__name__)

# Initialize Whisper model
model = WhisperModel("base", device="cpu")

@app.websocket('/audio')
async def audio_stream():
    audio_buffer = []
    RATE = 16000
    CHUNK_DURATION = 3  # Process every 3 seconds
    
    print("Client connected")
    
    try:
        while True:
            # Receive audio chunk from client
            data = await websocket.receive()
            
            if isinstance(data, bytes):
                audio_buffer.append(data)
                
                # Calculate buffer duration
                total_samples = sum(len(chunk) // 2 for chunk in audio_buffer)
                duration = total_samples / RATE
                
                # Process when buffer reaches threshold
                if duration >= CHUNK_DURATION:
                    # Convert to numpy array
                    audio_data = b''.join(audio_buffer)
                    audio_np = np.frombuffer(audio_data, dtype=np.int16)
                    audio_float = audio_np.astype(np.float32) / 32768.0
                    
                    # Transcribe
                    segments, info = model.transcribe(audio_float, language="en")
                    
                    # Send transcription back
                    for segment in segments:
                        await websocket.send(segment.text.strip())
                        print(f"Transcribed: {segment.text}")
                    
                    # Keep last 0.5s for context overlap
                    overlap_samples = int(RATE * 0.5)
                    overlap_bytes = overlap_samples * 2
                    audio_buffer = [audio_data[-overlap_bytes:]]
                    
    except asyncio.CancelledError:
        print("Client disconnected")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)