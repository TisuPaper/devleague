# Backend: FastAPI + Gmail/Pub/Sub pipeline
FROM python:3.12-slim

# Keep Python from writing .pyc and buffering logs (so `docker logs` is live)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install deps first so this layer caches across code changes
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Run as a non-root user. State dirs are created and chowned here so the
# mounted volume is writable without running the app as root.
RUN useradd --create-home --uid 10001 appuser \
 && mkdir -p /app/downloads /app/processed \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status==200 else 1)"

# IMPORTANT: a single worker, deliberately.
# process_new_emails() serializes Pub/Sub redeliveries with an in-process
# asyncio.Lock, and client state lives in local JSON files. Running multiple
# workers would break both -- concurrent workers would reprocess the same
# message (duplicate downloads and duplicate billed Gemini calls) and race on
# the state files. Scaling out requires replacing both with shared storage.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
