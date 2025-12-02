"""
Practice Mode WebSocket Server (Quart-based)
Provides real-time STT for solo practice mode using Whisper with optimized accuracy.
This runs as a separate service to bypass Firebase CDN WebSocket limitations.
"""

from quart import Blueprint, websocket, Quart
from quart_cors import cors
import asyncio
import json
import numpy as np
from datetime import datetime, timezone

from faster_whisper import WhisperModel 

# Lazy initialization for Whisper model
MODEL_CACHE_DIR = "/app/model_cache"
AUDIO_RATE = 16000  # 16kHz sample rate
CHUNK_DURATION = 2  # Process audio every 2 seconds
MIN_AUDIO_LENGTH = 0.5  # Minimum 0.5 seconds of audio to process

# Lazy initialization for Whisper model
_whisper_model = None

def get_whisper_model():
    """Lazy initialization of Whisper model for speech-to-text"""
    global _whisper_model
    if _whisper_model is None:
        try:
            print(f"Loading Whisper model from local cache: {MODEL_CACHE_DIR}...")
            
            # Tell it to look in the local folder, NOT download from web
            _whisper_model = WhisperModel(
                "base", 
                device="cpu", 
                download_root=MODEL_CACHE_DIR,  # <--- CRITICAL: Points to baked-in files
                local_files_only=True,          # <--- CRITICAL: Enforce no downloading
                compute_type="int8"
            )
            print("Whisper model loaded successfully")
        except ImportError:
            print("WARNING: faster-whisper not installed. Practice mode STT will not work.")
            return None
        except Exception as e:
            print(f"CRITICAL ERROR loading Whisper model: {e}")
            print(f"Did you run download_model.py during the Docker build?")
            return None
    return _whisper_model

# Audio buffers for active connections
audio_buffers = {}
# Track last transcribed text to avoid duplicates
last_transcriptions = {}

# Create Quart app and blueprint
practice_ws_bp = Blueprint("practice_ws", __name__)
app = Quart(__name__)

# Configure CORS
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://ladderup-5e25d.web.app",
    "https://ladderup-5e25d.firebaseapp.com"
]

app = cors(app, allow_origin=ALLOWED_ORIGINS, allow_credentials=True)


@app.route("/health")
async def health_check():
    return "OK", 200


async def process_audio_chunk(connection_id: str, audio_chunk: bytes):
    """
    Process audio chunk with Whisper STT and return transcription
    """
    # Initialize buffer if needed
    if connection_id not in audio_buffers:
        audio_buffers[connection_id] = []

    # Add chunk to buffer
    audio_buffers[connection_id].append(audio_chunk)

    # Calculate buffer duration
    total_samples = sum(len(chunk) // 2 for chunk in audio_buffers[connection_id])
    duration = total_samples / AUDIO_RATE

    # Log buffer status periodically
    if len(audio_buffers[connection_id]) % 50 == 0:
        print(f"[{connection_id}] Buffer: {len(audio_buffers[connection_id])} chunks, {duration:.2f}s duration")

    # Process when buffer reaches threshold
    if duration >= CHUNK_DURATION:
        print(f"[{connection_id}] Processing audio chunk ({duration:.2f}s of audio)")
        try:
            # Convert to numpy array
            audio_data = b''.join(audio_buffers[connection_id])
            audio_np = np.frombuffer(audio_data, dtype=np.int16)
            audio_float = audio_np.astype(np.float32) / 32768.0

            # Skip if audio is too short
            if len(audio_float) / AUDIO_RATE < MIN_AUDIO_LENGTH:
                audio_buffers[connection_id] = []
                return None

            # Transcribe with Whisper
            whisper = get_whisper_model()
            if whisper is None:
                return {"error": "Speech recognition not available"}

            segments, info = whisper.transcribe(
                audio_float,
                language="en",
                beam_size=5,
                best_of=5,
                temperature=0.0,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
                word_timestamps=False,
                condition_on_previous_text=True
            )

            # Collect transcribed text
            transcription_text = ""
            for segment in segments:
                text = segment.text.strip()
                if text:
                    transcription_text += text + " "

            # Clear buffer
            audio_buffers[connection_id] = []

            # Return transcription if not empty
            if transcription_text.strip():
                current_text = transcription_text.strip()
                print(f"[{connection_id}] Transcription generated: '{current_text}'")

                # Skip exact duplicates
                last_text = last_transcriptions.get(connection_id, "")
                if current_text == last_text:
                    print(f"[{connection_id}] SKIPPING exact duplicate")
                    return None

                last_transcriptions[connection_id] = current_text
                print(f"[{connection_id}] Sending NEW transcription to client")
                return {
                    "type": "transcription",
                    "text": current_text,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

        except Exception as e:
            print(f"Error processing audio for connection {connection_id}: {e}")
            import traceback
            traceback.print_exc()
            audio_buffers[connection_id] = []
            return {"error": "Error processing audio. Please try again."}

    return None


async def process_final_audio(connection_id: str):
    """Process any remaining audio in buffer when recording stops"""
    if connection_id not in audio_buffers or not audio_buffers[connection_id]:
        return None

    audio_data = b''.join(audio_buffers[connection_id])
    if len(audio_data) == 0:
        return None

    audio_np = np.frombuffer(audio_data, dtype=np.int16)
    audio_float = audio_np.astype(np.float32) / 32768.0

    if len(audio_float) / AUDIO_RATE < MIN_AUDIO_LENGTH:
        return None

    try:
        whisper = get_whisper_model()
        if whisper is None:
            return None

        segments, info = whisper.transcribe(
            audio_float,
            language="en",
            beam_size=5,
            best_of=5,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            word_timestamps=False,
            condition_on_previous_text=True
        )

        transcription_text = ""
        for segment in segments:
            text = segment.text.strip()
            if text:
                transcription_text += text + " "

        if transcription_text.strip():
            return {
                "type": "transcription",
                "text": transcription_text.strip(),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    except Exception as e:
        print(f"Error processing final audio: {e}")

    return None


@practice_ws_bp.websocket("/ws/practice")
async def practice_stt_websocket():
    """WebSocket endpoint for practice mode speech-to-text"""
    await websocket.accept()

    # Generate unique connection ID
    connection_id = f"practice_{id(websocket._get_current_object())}"
    audio_buffers[connection_id] = []
    last_transcriptions[connection_id] = ""

    print(f"Practice STT connection established: {connection_id}")

    try:
        # Send connection confirmation
        await websocket.send(json.dumps({
            "type": "connected",
            "message": "Practice mode STT ready"
        }))

        # Main message loop
        while True:
            try:
                message = await websocket.receive()
            except asyncio.CancelledError:
                break

            # Handle binary audio data
            if isinstance(message, bytes):
                result = await process_audio_chunk(connection_id, message)
                if result:
                    print(f"[{connection_id}] Sending transcription result")
                    await websocket.send(json.dumps(result))

            # Handle JSON control messages
            elif isinstance(message, str):
                try:
                    data = json.loads(message)
                    msg_type = data.get("type")

                    if msg_type == "start_audio":
                        print(f"{connection_id}: Audio recording started")
                        audio_buffers[connection_id] = []
                        last_transcriptions[connection_id] = ""
                        await websocket.send(json.dumps({
                            "type": "status",
                            "message": "Recording started"
                        }))

                    elif msg_type == "stop_audio":
                        print(f"{connection_id}: Audio recording stopped")
                        # Process remaining audio
                        final_result = await process_final_audio(connection_id)
                        if final_result:
                            await websocket.send(json.dumps(final_result))

                        audio_buffers[connection_id] = []
                        await websocket.send(json.dumps({
                            "type": "status",
                            "message": "Recording stopped"
                        }))

                    elif msg_type == "reset_transcript":
                        print(f"{connection_id}: Transcript reset")
                        audio_buffers[connection_id] = []
                        last_transcriptions[connection_id] = ""
                        await websocket.send(json.dumps({
                            "type": "status",
                            "message": "Transcript reset"
                        }))

                    else:
                        print(f"{connection_id}: Unknown message type: {msg_type}")

                except json.JSONDecodeError:
                    print(f"{connection_id}: Invalid JSON message")

    except asyncio.CancelledError:
        print(f"Practice STT WebSocket cancelled: {connection_id}")
    except Exception as e:
        print(f"Practice STT WebSocket error for {connection_id}: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        if connection_id in audio_buffers:
            del audio_buffers[connection_id]
        if connection_id in last_transcriptions:
            del last_transcriptions[connection_id]
        print(f"Practice STT connection closed: {connection_id}")


# Register blueprint
app.register_blueprint(practice_ws_bp)

# To run: hypercorn src.server_comps.practice_websocket_server:app --bind 0.0.0.0:8001