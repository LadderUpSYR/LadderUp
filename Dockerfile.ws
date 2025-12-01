# Use official lightweight Python image
FROM python:3.10-slim

# 1. Install system dependencies
# 'ffmpeg' is usually required for Whisper/Audio processing
# 'build-essential' is needed if any pip packages need to compile C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 2. Set Working Directory to Root
WORKDIR /app

# 3. Copy dependencies first (for Docker layer caching)
COPY requirements.txt .

# 4. Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of the application
# (The .dockerignore file will filter out all the .js/.jsx/node_modules)
COPY . .

# 6. Set Environment Variables
# PYTHONUNBUFFERED ensures logs show up in Cloud Logging immediately
ENV PYTHONUNBUFFERED=1

COPY src/download_model.py /app/src/download_model.py

RUN python /app/src/download_model.py

# 7. Run the application
# We use 'exec' to ensure hypercorn receives signals (like SIGTERM) correctly
# We bind to 0.0.0.0:$PORT because Cloud Run injects the PORT env var
CMD exec hypercorn --bind 0.0.0.0:$PORT src.server_comps.websocketserver:app