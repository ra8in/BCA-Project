FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies for psycopg2 and Pillow (libjpeg-dev, zlib1g-dev)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --create-home appuser

WORKDIR /app

# Install Python dependencies (cached layer — only re-runs when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make entrypoint script executable
RUN chmod +x /app/entrypoint.sh

# Create media directory and set ownership
RUN mkdir -p /app/media /app/staticfiles && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose Django port
EXPOSE 8000

# Health check — verify Django responds
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/stocks/market-status/ || exit 1

# Entrypoint handles migrations, superuser, and data sync
ENTRYPOINT ["/app/entrypoint.sh"]
