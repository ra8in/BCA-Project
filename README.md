# BCA Paper Trading Project

A full-stack paper trading application built with Django REST Framework and React.

## Prerequisites

The only thing you need installed:
- **Docker Desktop** ([Download here](https://www.docker.com/products/docker-desktop/))

That's it! No Python, Node, or PostgreSQL installation required.

## Quick Start

1. **Clone the repository** (or download the code):
   ```bash
   git clone <your-repo-url>
   cd BCA_Project
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```
   (Edit `.env` if you want to change default settings)

3. **Start everything**:
   ```bash
   docker compose up --build
   ```

4. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend Admin: http://localhost:8000/admin
     - Username: `admin`
     - Password: `admin123`

## Stopping the Application

Press `Ctrl+C` in the terminal, then:
```bash
docker compose down
```

## Resetting the Database

To start fresh (delete all data):
```bash
docker compose down -v
docker compose up --build
```

## Restoring Data (Optional)

If you have a `db_backup.json` file (shared by a friend), place it in the root folder.
When you run `docker-compose up`, the system will **automatically import it** for you!

## Troubleshooting

**Problem**: "Port 5432 is already in use"
- **Solution**: You have PostgreSQL running locally. Stop it or change the port in `docker-compose.yml`.

**Problem**: "Frontend shows connection error"
- **Solution**: Wait 30 seconds for the backend to fully start and run migrations.
