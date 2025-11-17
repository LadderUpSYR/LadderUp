# 1. Start with an official, lightweight Python base
FROM python:3.11-slim

# 2. Set a working directory inside the container
WORKDIR /app

# 3. Copy just the requirements file and install libraries first
# This is a cache-optimization trick. Docker won't re-install
# these unless requirements.txt changes.
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 4. Now copy the rest of your application code
# The 'src' folder and anything else.
COPY . .

# 5. Tell Cloud Run what port your app will listen on
# (This doesn't actually run the app, just provides metadata)
EXPOSE 8080

# 6. The command to run your app
# Cloud Run sets the $PORT environment variable for you (e.g., to 8080).
# Your app MUST listen on this port.
CMD sh -c "uvicorn src.server_comps.server:app --host 0.0.0.0 --port $PORT"