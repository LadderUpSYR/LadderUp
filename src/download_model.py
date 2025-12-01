# src/download_model.py
from faster_whisper import WhisperModel
import os

# Define a specific directory for the model
cache_dir = "/app/model_cache"

print(f"Pre-downloading Whisper model to {cache_dir}...")
# This triggers the download and saves it to the specific folder
model = WhisperModel("base", device="cpu", download_root=cache_dir)
print("Download complete.")