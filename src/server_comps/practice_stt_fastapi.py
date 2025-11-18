"""
Practice Mode Speech-to-Text WebSocket Handler for FastAPI
Provides real-time STT for solo practice mode using Whisper with optimized accuracy
"""

import json
import asyncio
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Optional
from fastapi import WebSocket, WebSocketDisconnect

# Lazy initialization for Whisper model
_whisper_model = None

def get_whisper_model():
    """Lazy initialization of Whisper model for speech-to-text"""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            print("Loading Whisper model for practice mode...")
            # Use 'small' model for better accuracy (medium is even better but slower)
            # compute_type="int8" for faster CPU inference
            _whisper_model = WhisperModel(
                "small",
                device="cpu",
                compute_type="int8"
            )
            print("Whisper model loaded successfully")
        except ImportError:
            print("WARNING: faster-whisper not installed. Practice mode STT will not work.")
            return None
        except Exception as e:
            print(f"WARNING: Error loading Whisper model: {e}")
            return None
    return _whisper_model

# Constants for audio processing
AUDIO_RATE = 16000  # 16kHz sample rate
CHUNK_DURATION = 2  # Process audio every 2 seconds (faster feedback)
MIN_AUDIO_LENGTH = 0.5  # Minimum 0.5 seconds of audio to process

# Audio buffers for active connections
audio_buffers: Dict[str, list] = {}
# Track last transcribed text to avoid duplicates
last_transcriptions: Dict[str, str] = {}


async def process_audio_chunk(connection_id: str, audio_chunk: bytes) -> Optional[dict]:
    """
    Process audio chunk with Whisper STT and return transcription
    
    Args:
        connection_id: Unique identifier for this WebSocket connection
        audio_chunk: Binary audio data (int16 PCM)
        
    Returns:
        dict: Transcription result or None if buffer not ready
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
            
            # Transcribe with Whisper with optimized settings
            whisper = get_whisper_model()
            if whisper is None:
                return {"error": "Speech recognition not available"}
            
            # Use VAD filter and optimized beam size for better accuracy
            segments, info = whisper.transcribe(
                audio_float,
                language="en",
                beam_size=5,  # Higher beam size for better accuracy
                best_of=5,  # Number of candidates to consider
                temperature=0.0,  # Deterministic output
                vad_filter=True,  # Filter out non-speech
                vad_parameters=dict(
                    min_silence_duration_ms=500  # Minimum silence to split
                ),
                word_timestamps=False,
                condition_on_previous_text=True  # Use context from previous text
            )
            
            # Collect all transcribed text
            transcription_text = ""
            for segment in segments:
                text = segment.text.strip()
                if text:
                    transcription_text += text + " "
            
            # Clear buffer completely (no overlap to avoid duplicates)
            audio_buffers[connection_id] = []
            
            # Return transcription if not empty
            if transcription_text.strip():
                current_text = transcription_text.strip()
                
                print(f"[{connection_id}] Transcription generated: '{current_text}'")
                
                # Simple duplicate check - only skip if EXACT match with last transcription
                last_text = last_transcriptions.get(connection_id, "")
                
                if current_text == last_text:
                    print(f"[{connection_id}] SKIPPING exact duplicate")
                    return None
                
                # Update last transcription
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
            # Clear buffer on error
            audio_buffers[connection_id] = []
            return {
                "error": "Error processing audio. Please try again."
            }
    
    return None


async def practice_stt_websocket_handler(websocket: WebSocket):
    """
    WebSocket endpoint handler for practice mode speech-to-text
    Accepts audio streams and returns real-time transcriptions using Whisper
    
    This function should be called from a FastAPI WebSocket route.
    """
    await websocket.accept()
    
    # Generate unique connection ID
    connection_id = f"practice_{id(websocket)}"
    audio_buffers[connection_id] = []
    
    print(f"Practice STT connection established: {connection_id}")
    
    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Practice mode STT ready"
        })
        
        # Main message loop
        while True:
            try:
                # Receive message (can be bytes or text)
                message = await websocket.receive()
            except RuntimeError:
                # WebSocket disconnected
                break
            
            # Handle binary audio data
            if "bytes" in message:
                audio_data = message["bytes"]
                result = await process_audio_chunk(connection_id, audio_data)
                if result:
                    print(f"[{connection_id}] Sending transcription result to WebSocket")
                    try:
                        await websocket.send_json(result)
                        print(f"[{connection_id}] Successfully sent transcription")
                    except RuntimeError:
                        # WebSocket closed during send
                        print(f"[{connection_id}] WebSocket closed during send")
                        break
            
            # Handle JSON control messages
            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")
                    
                    if msg_type == "start_audio":
                        print(f"{connection_id}: Audio recording started")
                        audio_buffers[connection_id] = []
                        last_transcriptions[connection_id] = ""  # Clear last transcription
                        await websocket.send_json({
                            "type": "status",
                            "message": "Recording started"
                        })
                    
                    elif msg_type == "stop_audio":
                        print(f"{connection_id}: Audio recording stopped")
                        # Process any remaining audio in buffer
                        if connection_id in audio_buffers and audio_buffers[connection_id]:
                            # Force process remaining buffer
                            audio_data = b''.join(audio_buffers[connection_id])
                            if len(audio_data) > 0:
                                audio_np = np.frombuffer(audio_data, dtype=np.int16)
                                audio_float = audio_np.astype(np.float32) / 32768.0
                                
                                # Check minimum length
                                if len(audio_float) / AUDIO_RATE >= MIN_AUDIO_LENGTH:
                                    try:
                                        whisper = get_whisper_model()
                                        if whisper is not None:
                                            # Use same optimized settings for final chunk
                                            segments, info = whisper.transcribe(
                                                audio_float,
                                                language="en",
                                                beam_size=5,
                                                best_of=5,
                                                temperature=0.0,
                                                vad_filter=True,
                                                vad_parameters=dict(
                                                    min_silence_duration_ms=500
                                                ),
                                                word_timestamps=False,
                                                condition_on_previous_text=True
                                            )
                                            
                                            transcription_text = ""
                                            for segment in segments:
                                                text = segment.text.strip()
                                                if text:
                                                    transcription_text += text + " "
                                            
                                            if transcription_text.strip():
                                                try:
                                                    await websocket.send_json({
                                                        "type": "transcription",
                                                        "text": transcription_text.strip(),
                                                        "timestamp": datetime.now(timezone.utc).isoformat()
                                                    })
                                                except RuntimeError:
                                                    # WebSocket already closed, ignore
                                                    print(f"{connection_id}: WebSocket closed, skipping final transcription")
                                    except Exception as e:
                                        print(f"Error processing final audio: {e}")
                        
                        audio_buffers[connection_id] = []
                        try:
                            await websocket.send_json({
                                "type": "status",
                                "message": "Recording stopped"
                            })
                        except RuntimeError:
                            # WebSocket already closed, ignore
                            print(f"{connection_id}: WebSocket closed, skipping status message")
                    
                    elif msg_type == "reset_transcript":
                        print(f"{connection_id}: Transcript reset")
                        audio_buffers[connection_id] = []
                        last_transcriptions[connection_id] = ""  # Clear last transcription
                        await websocket.send_json({
                            "type": "status",
                            "message": "Transcript reset"
                        })
                    
                    else:
                        print(f"{connection_id}: Unknown message type: {msg_type}")
                
                except json.JSONDecodeError:
                    print(f"{connection_id}: Invalid JSON message")
                    
    except WebSocketDisconnect:
        print(f"Practice STT WebSocket disconnected: {connection_id}")
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
