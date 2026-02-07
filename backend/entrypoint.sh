#!/bin/bash
set -e

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

echo "Running migrations..."
python manage.py migrate

echo "Creating superuser (if not exists)..."
python manage.py shell << END
from users_app.models import CustomUser
if not CustomUser.objects.filter(username='admin').exists():
    CustomUser.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print("Superuser created: admin/admin123")
END

# Seed data if JSON file exists
if [ -f "../sharehub_home_data.json" ]; then
    echo "Seeding data from sharehub_home_data.json..."
    python seed_full_data.py || echo "Seeding skipped or failed"
fi

echo "Starting server..."
exec python manage.py runserver 0.0.0.0:8000
