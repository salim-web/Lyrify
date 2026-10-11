# Dockerfile optimized for Render.com (512MB RAM), Hugging Face, or general cloud container hosting
FROM python:3.12-slim

# Install system dependencies: FFmpeg is required for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    TRITON_HOME=/tmp/.triton \
    TRITON_CACHE_DIR=/tmp/.triton/cache \
    PYTHONUNBUFFERED=1 \
    PORT=10000

WORKDIR $HOME/app

# Install PyTorch CPU first (lighter for CPU hosting)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
COPY --chown=user requirements.txt .
RUN grep -v "torch" requirements.txt > reqs_no_torch.txt && \
    pip install --no-cache-dir -r reqs_no_torch.txt

# Pre-download lightweight "tiny" Whisper model (~39MB, easily fits in 512MB RAM)
RUN python3 -c "import whisper; whisper.load_model('tiny', download_root='/home/user/.cache/whisper')"

# Copy application code
COPY --chown=user . .

EXPOSE 10000

# Dynamically bind to the port provided by Render ($PORT) or default to 10000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
