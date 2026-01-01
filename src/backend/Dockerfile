# SOTA 2025: NVIDIA CUDA 12.4 Base Image (Ubuntu 22.04)
# Ensures maximum compatibility with Torch 2.x and Faster-Whisper
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

# SOTA: Set non-interactive timezone to avoid apt hangs
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# 1. System Dependencies (FFmpeg + Python 3.10)
# Clean apt cache in the same layer to keep image small (Docker Guard)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3-pip \
    python3.10-distutils \
    ffmpeg \
    curl \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Setup Python Alias
RUN ln -s /usr/bin/python3.10 /usr/bin/python

# 3. Work Directory
WORKDIR /app

# 4. Dependencies Strategy: Install Requirements First (Cache Friendly)
COPY requirements.txt .

# SOTA: Upgrade pip and install with --no-cache-dir to save space
RUN python -m pip install --upgrade pip && \
    python -m pip install --no-cache-dir -r requirements.txt

# 5. Copy Application Code
COPY . .

# 6. SOTA: Create Non-Root User for Security (Best Practice)
# However, for GPU access simplicity in some setups, root is often used. 
# We'll stick to root for now unless user enforced non-root, 
# but we'll allow an easy switch.
# RUN useradd -m -u 1000 user
# USER user

# 7. Environment Setup
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# 8. Exposure
EXPOSE 8000

# 9. Healthcheck (SOTA Docker Guard)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# 10. Launch Command
CMD ["python", "app_main.py"]
