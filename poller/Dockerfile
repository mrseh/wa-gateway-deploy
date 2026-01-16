FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN adduser --disabled-password --gecos '' --uid 1001 poller
USER poller
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD pgrep -f pon_poller.py || exit 1
CMD ["python", "pon_poller.py"]
