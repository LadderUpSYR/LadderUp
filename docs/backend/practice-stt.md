# Practice Mode Speech-to-Text Documentation

Documentation for `src/server_comps/practice_stt_fastapi.py` - Real-time speech-to-text using Whisper for practice mode.

## Overview

Provides WebSocket-based real-time speech-to-text transcription for solo practice mode using OpenAI's Whisper model.

## Architecture

```
Browser Mic → Audio Chunks (WebSocket) → Server Buffer →
Whisper Transcription → JSON Response → Display in UI
```

## Dependencies

```python
from faster_whisper import WhisperModel  # High-performance Whisper
import numpy as np
from fastapi import WebSocket, WebSocketDisconnect
```

### Installation

```bash
pip install faster-whisper
```

## Audio Configuration

```python
AUDIO_RATE = 16000  # 16kHz sample rate (Whisper requirement)
CHUNK_DURATION = 2  # Process every 2 seconds
MIN_AUDIO_LENGTH = 0.5  # Minimum 0.5s to process
```

### Audio Format

**Required from Client:**
- Sample Rate: 16,000 Hz (16kHz)
- Encoding: int16 PCM (signed 16-bit)
- Channels: Mono (1 channel)
- Byte Order: Little-endian

## Whisper Model

### Model Loading

```python
def get_whisper_model():
    """Lazy initialization of Whisper model"""
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = WhisperModel(
            "small",  # Model size
            device="cpu",  # CPU inference
            compute_type="int8"  # Quantization for speed
        )
    return _whisper_model
```

**Model Sizes:**
- `tiny`: Fastest, least accurate (~39M params)
- `base`: Fast, basic accuracy (~74M params)
- `small`: **Current** - Good balance (~244M params)
- `medium`: Better accuracy, slower (~769M params)
- `large`: Best accuracy, slowest (~1550M params)

**Device Options:**
- `cpu`: CPU inference (current)
- `cuda`: GPU inference (if available)

**Compute Types:**
- `int8`: Fastest, quantized (current)
- `float16`: Faster, requires GPU
- `float32`: Slowest, most accurate

### First Load Time

- **small model**: ~5-10 seconds initial load
- Subsequent requests: instant (model cached in memory)
- Downloads model on first use

## WebSocket Handler

### Endpoint

```python
@app.websocket("/ws/practice")
async def practice_stt_websocket(websocket: WebSocket):
    await practice_stt_websocket_handler(websocket)
```

### Connection Flow

```python
async def practice_stt_websocket_handler(websocket: WebSocket):
```

**Process:**

1. **Accept Connection**
   ```python
   await websocket.accept()
   connection_id = str(uuid.uuid4())
   ```

2. **Send Ready Signal**
   ```python
   await websocket.send_json({
       "type": "ready",
       "message": "Speech-to-text ready"
   })
   ```

3. **Receive Audio Loop**
   ```python
   while True:
       audio_chunk = await websocket.receive_bytes()
       result = await process_audio_chunk(connection_id, audio_chunk)
       if result:
           await websocket.send_json(result)
   ```

4. **Handle Disconnect**
   ```python
   except WebSocketDisconnect:
       cleanup_connection(connection_id)
   ```

## Audio Processing

### process_audio_chunk()

```python
async def process_audio_chunk(
    connection_id: str,
    audio_chunk: bytes
) -> Optional[dict]
```

**Parameters:**
- `connection_id`: Unique identifier for WebSocket connection
- `audio_chunk`: Binary audio data (int16 PCM)

**Returns:**
- `dict`: Transcription result or None if buffer not ready

**Process:**

1. **Initialize Buffer**
   ```python
   if connection_id not in audio_buffers:
       audio_buffers[connection_id] = []
   ```

2. **Append Chunk**
   ```python
   audio_buffers[connection_id].append(audio_chunk)
   ```

3. **Calculate Duration**
   ```python
   total_samples = sum(len(chunk) // 2 for chunk in audio_buffers[connection_id])
   duration = total_samples / AUDIO_RATE
   ```

4. **Check Threshold**
   ```python
   if duration >= CHUNK_DURATION:  # 2 seconds
       # Process audio
   ```

5. **Convert to Float**
   ```python
   audio_data = b''.join(audio_buffers[connection_id])
   audio_np = np.frombuffer(audio_data, dtype=np.int16)
   audio_float = audio_np.astype(np.float32) / 32768.0
   ```

6. **Transcribe**
   ```python
   whisper = get_whisper_model()
   segments, info = whisper.transcribe(
       audio_float,
       language="en",
       beam_size=5,  # Accuracy
       best_of=5,  # Candidate selection
       vad_filter=True,  # Voice activity detection
       vad_parameters=dict(
           min_silence_duration_ms=500
       )
   )
   ```

7. **Extract Text**
   ```python
   text = " ".join([segment.text for segment in segments])
   ```

8. **Clear Buffer**
   ```python
   audio_buffers[connection_id] = []
   ```

9. **Return Result**
   ```python
   return {
       "type": "transcription",
       "text": text.strip(),
       "confidence": avg_confidence,
       "is_final": True
   }
   ```

## Transcription Options

### Voice Activity Detection (VAD)

```python
vad_filter=True  # Filters out silence
vad_parameters=dict(
    min_silence_duration_ms=500  # 0.5s silence threshold
)
```

**Benefits:**
- Reduces false transcriptions
- Ignores background noise
- Improves accuracy

### Beam Search

```python
beam_size=5  # Higher = more accurate, slower
```

**Values:**
- 1: Greedy search (fastest)
- 5: **Current** - Good balance
- 10: Better accuracy, 2x slower

### Best Of

```python
best_of=5  # Number of candidates
```

Generates multiple hypotheses and selects best.

### Language

```python
language="en"  # Force English
```

**Options:**
- "en": English
- "es": Spanish
- None: Auto-detect (slower)

## Response Format

### Transcription Response

```json
{
    "type": "transcription",
    "text": "This is what was said",
    "confidence": 0.95,
    "is_final": true
}
```

**Fields:**
- `type`: Always "transcription"
- `text`: Transcribed text
- `confidence`: Average confidence score (0-1)
- `is_final`: Whether this is final (always true currently)

### Error Response

```json
{
    "type": "error",
    "error": "Speech recognition not available"
}
```

### Ready Response

```json
{
    "type": "ready",
    "message": "Speech-to-text ready"
}
```

## Client Integration

### JavaScript Example

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8000/ws/practice');

ws.onopen = () => {
    console.log('Connected to STT');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'ready') {
        // Start sending audio
        startAudioCapture();
    }
    
    if (data.type === 'transcription') {
        displayTranscript(data.text);
    }
};

// Capture audio from microphone
async function startAudioCapture() {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            channelCount: 1,
            sampleRate: 16000
        }
    });
    
    const audioContext = new AudioContext({
        sampleRate: 16000
    });
    
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
        const audioData = e.inputBuffer.getChannelData(0);
        
        // Convert float32 to int16
        const int16Data = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        }
        
        // Send to WebSocket
        ws.send(int16Data.buffer);
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
}
```

## Memory Management

### Audio Buffers

```python
audio_buffers: Dict[str, list] = {}
last_transcriptions: Dict[str, str] = {}
```

**Cleanup on Disconnect:**
```python
def cleanup_connection(connection_id: str):
    audio_buffers.pop(connection_id, None)
    last_transcriptions.pop(connection_id, None)
```

**Memory Concerns:**
- Each connection stores ~2 seconds of audio
- 2 seconds @ 16kHz int16 = 64KB per connection
- 100 concurrent users = ~6.4MB buffer memory
- Whisper model = ~500MB RAM

## Performance Optimization

### Chunking Strategy

**Current: 2-second chunks**

**Tradeoffs:**
- **Smaller chunks** (1s): Faster feedback, lower accuracy
- **Larger chunks** (3-4s): Better accuracy, higher latency

### Model Selection

| Model | Accuracy | Speed | Memory |
|-------|----------|-------|--------|
| tiny | Low | 32x | 75 MB |
| base | Medium | 16x | 142 MB |
| small | **Good** | **10x** | **483 MB** |
| medium | Better | 4x | 1.5 GB |
| large | Best | 1x | 2.9 GB |

### Compute Type

| Type | Speed | Accuracy | Requirements |
|------|-------|----------|--------------|
| int8 | **Fast** | Good | CPU only |
| float16 | Faster | Better | GPU required |
| float32 | Baseline | Best | High memory |

## Error Handling

### Model Load Failure

```python
try:
    _whisper_model = WhisperModel(...)
except ImportError:
    print("WARNING: faster-whisper not installed")
    return None
except Exception as e:
    print(f"WARNING: Error loading Whisper model: {e}")
    return None
```

**Client receives:**
```json
{
    "error": "Speech recognition not available"
}
```

### WebSocket Disconnect

```python
except WebSocketDisconnect:
    print(f"[{connection_id}] Client disconnected")
    cleanup_connection(connection_id)
```

### Transcription Errors

```python
except Exception as e:
    print(f"[{connection_id}] Transcription error: {e}")
    return {
        "type": "error",
        "error": "Transcription failed"
    }
```

## Logging

### Debug Information

```python
# Buffer status (every 50 chunks)
if len(audio_buffers[connection_id]) % 50 == 0:
    print(f"[{connection_id}] Buffer: {len(chunks)} chunks, {duration:.2f}s")

# Processing start
print(f"[{connection_id}] Processing audio chunk ({duration:.2f}s)")

# Transcription result
print(f"[{connection_id}] Transcribed: {text}")
```

## Latency Analysis

**Total Latency Breakdown:**

1. **Audio Buffering**: 2 seconds (configurable)
2. **Network Transfer**: ~50-100ms
3. **Transcription**: ~500-1000ms (small model)
4. **Response Send**: ~10-20ms

**Total**: ~2.5-3 seconds from speech to text display

**Optimization Opportunities:**
- Reduce CHUNK_DURATION to 1s (less accuracy)
- Use tiny/base model (less accuracy)
- GPU acceleration (if available)

## Accuracy Improvements

### Current Settings

```python
beam_size=5
best_of=5
vad_filter=True
language="en"
```

### Enhanced Accuracy

```python
# Use medium or large model
model = WhisperModel("medium", ...)

# Increase beam search
beam_size=10

# More candidates
best_of=10

# Adjust VAD sensitivity
vad_parameters=dict(
    min_silence_duration_ms=300,
    speech_pad_ms=400
)
```

**Tradeoff**: 2-3x slower processing

## Testing

### Unit Tests

```bash
pytest unittests/test_practice_stt.py
```

### Manual Testing

```python
# Test transcription directly
from src.server_comps.practice_stt_fastapi import get_whisper_model

model = get_whisper_model()

# Load test audio file
import numpy as np
audio = np.load("test_audio.npy")

segments, info = model.transcribe(audio, language="en")
text = " ".join([s.text for s in segments])
print(f"Transcribed: {text}")
```

### WebSocket Testing

```bash
# Use wscat for testing
npm install -g wscat

# Connect
wscat -c ws://localhost:8000/ws/practice

# Send test audio file
wscat -c ws://localhost:8000/ws/practice < test_audio.bin
```

## Security Considerations

### Audio Data Privacy

- Audio not stored (processed in memory only)
- Buffers cleared after transcription
- No logging of audio content
- Consider encryption for sensitive use cases

### Resource Limits

**Current**: No limits

**Recommended:**
```python
MAX_CONNECTIONS = 100
MAX_BUFFER_SIZE = 10  # seconds
CONNECTION_TIMEOUT = 300  # 5 minutes

# Track active connections
if len(audio_buffers) >= MAX_CONNECTIONS:
    raise HTTPException(503, "Server at capacity")
```

### Rate Limiting

Prevent abuse:
```python
# Limit transcription requests per connection
request_count = transcription_counts.get(connection_id, 0)
if request_count > 100:  # per hour
    raise HTTPException(429, "Rate limit exceeded")
```

## Future Enhancements

### 1. Streaming Transcription

Real-time word-by-word updates:
```python
# Use Whisper's streaming API
for segment in whisper.transcribe_stream(audio):
    await websocket.send_json({
        "type": "partial",
        "text": segment.text
    })
```

### 2. Speaker Diarization

Identify multiple speakers:
```python
from pyannote.audio import Pipeline
diarization = pipeline(audio)
```

### 3. Punctuation & Formatting

Add punctuation to transcripts:
```python
from deepmultilingualpunctuation import PunctuationModel
punctuated = punctuation_model.restore_punctuation(text)
```

### 4. Custom Vocabulary

Improve accuracy for domain terms:
```python
segments, info = whisper.transcribe(
    audio,
    language="en",
    hotwords="STAR,behavioral,interview"  # Custom vocabulary
)
```

### 5. Language Detection

Auto-detect speaker language:
```python
segments, info = whisper.transcribe(
    audio,
    language=None  # Auto-detect
)
detected_language = info.language
```

## Monitoring

### Metrics to Track

- Active WebSocket connections
- Average transcription time
- Model load time
- Error rates
- Audio buffer sizes
- Memory usage

### Health Check

```python
@app.get("/api/stt/health")
async def stt_health():
    model = get_whisper_model()
    return {
        "status": "healthy" if model else "unavailable",
        "model_loaded": model is not None,
        "active_connections": len(audio_buffers)
    }
```

## Related Documentation

- [Server API](./server-api.md)
- [Practice Mode Frontend](../frontend/components.md#practice-mode)
- [Architecture Overview](../architecture-overview.md)
