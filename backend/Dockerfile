# Dockerfile for Hugging Face Spaces (and Docker container hosting)
FROM python:3.12-slim

# Install system dependencies: FFmpeg is required for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces expects user with UID 1000
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    TRITON_HOME=/tmp/.triton \
    TRITON_CACHE_DIR=/tmp/.triton/cache \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

# Install PyTorch CPU first (lighter and optimized for HF Free tier 16GB RAM CPU)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
COPY --chown=user requirements.txt .
# Filter out the torch line from requirements.txt to avoid re-installing CUDA torch
RUN grep -v "torch" requirements.txt > reqs_no_torch.txt && \
    pip install --no-cache-dir -r reqs_no_torch.txt

# Pre-download Whisper model weights into user cache so container starts immediately
RUN python3 -c "import whisper; whisper.load_model('small', download_root='/home/user/.cache/whisper')"

# Copy application code
COPY --chown=user . .

# Hugging Face Spaces listens on port 7860
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
