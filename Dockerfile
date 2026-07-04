FROM python:3.10-slim

# Install required system libraries for MediaPipe and OpenCV
RUN apt-get update && apt-get install -y \
    libgl1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgles2 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# Render sets the PORT environment variable
CMD uvicorn backend.app:app --host 0.0.0.0 --port $PORT
