#!/bin/bash
set -e

echo "=== BCA Project Backend Startup ==="

echo "Waiting for database..."
python << END
import os, time, psycopg2
from urllib.parse import urlparse

url = urlparse(os.environ['DATABASE_URL'])
for i in range(30):
    try:
        conn = psycopg2.connect(
            host=url.hostname,
            port=url.port,
            user=url.username,
            password=url.password,
            database=url.path[1:]
        )
        conn.close()
        print("Database ready!")
        break
    except:
        print(f"Waiting... ({i+1}/30)")
        time.sleep(1)
END

echo "Waiting for Redis..."
python << END
import os, time
redis_url = os.environ.get('REDIS_URL', '')
if redis_url:
    import redis
    r = redis.from_url(redis_url)
    for i in range(15):
        try:
            r.ping()
            print("Redis ready!")
            break
        except:
            print(f"Waiting for Redis... ({i+1}/15)")
            time.sleep(1)
else:
    print("No REDIS_URL set, using in-memory cache")
END

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput 2>/dev/null || echo "Static files collection skipped"

echo "Creating superuser (if not exists)..."
python manage.py shell << END
from users_app.models import CustomUser
if not CustomUser.objects.filter(username='admin').exists():
    CustomUser.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print("Superuser created: admin/admin123")
else:
    print("Superuser already exists")
END

# Seed LIVE data from NEPSE API on startup
echo "Syncing company data, prices, and indices from NEPSE..."
python manage.py sync_companies || echo "⚠️  Sync failed - continuing anyway (market may be closed)"

# Start server based on DEBUG mode
DEBUG_MODE="${DEBUG:-True}"
echo "=== Starting server (DEBUG=$DEBUG_MODE) ==="

if [ "$DEBUG_MODE" = "False" ] || [ "$DEBUG_MODE" = "false" ] || [ "$DEBUG_MODE" = "0" ]; then
    echo "Starting Gunicorn (production mode)..."
    exec gunicorn paper_trading_project.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers 3 \
        --timeout 120 \
        --access-logfile - \
        --error-logfile -
else
    echo "Starting Django runserver (development mode)..."
    exec python manage.py runserver 0.0.0.0:8000
fi
