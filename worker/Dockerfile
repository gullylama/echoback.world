# EchoBack fingerprint worker.
# CPU works fine for a founder cohort (a minute or two per track);
# swap the base image for a CUDA one when volume justifies a GPU.
FROM python:3.11-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY fingerprint.py .

# Model weights download on first run; mount a volume here to keep them.
ENV TORCH_HOME=/cache
VOLUME ["/cache"]

CMD ["python", "-u", "fingerprint.py"]
