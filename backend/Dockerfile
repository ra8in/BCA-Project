# ─────────────────────────────────────────────
# BCA Project – Django Backend
# ─────────────────────────────────────────────
FROM python:3.12-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── Stage 1: Build dependencies ──────────────
FROM base AS builder

# Install build-time system dependencies (gcc for C extensions, libpq-dev for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Production image ────────────────
FROM base AS production

LABEL maintainer="rabin" \
      project="bca-paper-trading" \
      description="Django backend for NEPSE Paper Trading System"

# Install only the runtime library for PostgreSQL (no compiler needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pre-built Python packages from builder stage
COPY --from=builder /install /usr/local

# Copy application source code
COPY . .

# Ensure entrypoint is executable and required directories exist
RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/staticfiles /app/media

# Expose Django server port
EXPOSE 8000

# Health check – verify the API is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fs http://localhost:8000/api/stocks/ || exit 1

# Entrypoint handles: DB wait → migrations → superuser → NEPSE sync → runserver
ENTRYPOINT ["/app/entrypoint.sh"]
