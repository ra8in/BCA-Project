FROM python:3.12-slim

# Install system dependencies for psycopg2
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose Django development server port
EXPOSE 8000

# Make entrypoint script executable
RUN chmod +x /app/entrypoint.sh

# Entry point script handles migrations, superuser, and live NEPSE API data syncing
ENTRYPOINT ["/app/entrypoint.sh"]
