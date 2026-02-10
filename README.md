# BCA Paper Trading Project

A full-stack paper trading application built with:
- **Backend**: Django REST Framework (Python 3.12)
- **Frontend**: React + Vite (Node 20)
- **Database**: PostgreSQL 15

## 🚀 Prerequisites

The **only** requirement is [Docker Desktop](https://www.docker.com/products/docker-desktop/).
You do **NOT** need to install Python, Node.js, or PostgreSQL manually.

## 🛠️ Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ra8in/BCA-Project.git
   cd BCA_Project
   ```

2. **Build & Start (First Time)**:
   ```bash
   docker-compose up --build
   ```
   *Note: The first run may take a few minutes to build images and seed the database.*

3. **Start Again (After Closing)**:
   ```bash
   docker-compose up
   ```
   *No need to rebuild every time! Just use `docker-compose up` for subsequent runs.*

4. **Access the App**:
   - **Frontend**: http://localhost:5173
   - **Backend Admin**: http://localhost:8000/admin/
     - **Username**: `admin`
     - **Password**: `admin123` (Created automatically if missing)

5. **Stop the App**:
   Press `Ctrl+C` or run:
   ```bash
   docker-compose down
   ```

## 📊 Data Management

### Automatic Seeding (Live Data)
This project **fetches live market data from ShareHub API** when starting with an empty database:
- **Source**: ShareHub Nepal API (`sharehubnepal.com`)
- **Logic**: On first startup, the system fetches real-time data and populates Stocks, Indices, Sectors, and price history.
- **Smart Skip**: Subsequent restarts skip seeding to preserve your data.

### How to Reset Database
If you want fresh data from the API:
   ```bash
   docker-compose down -v  # WARNING: Deletes local users/portfolios!
   docker-compose up
   ```

### Local Data Persistence
Your local users, portfolios, and trades are saved in a Docker Volume (`postgres_data`). They **persist** even if you restart your computer or stop Docker.
They are **private** to your machine and are not shared via Git.

## 🔧 Troubleshooting

### "Port 5432 is already in use"
You likely have a local PostgreSQL server running.
- **Linux/Mac**: `sudo service postgresql stop`
- **Windows**: Stop the PostgreSQL service in Task Manager.

### "Frontend connection refused" or "Network Error"
- Ensure the backend is fully running (wait for `Starting server...` in the logs).
- The frontend connects via a proxy configured in `vite.config.js` pointing to `http://backend:8000`.

### "ContainerConfig" Error
If Docker throws a configuration error during startup:
```bash
docker-compose down -v --remove-orphans
docker system prune -f
docker-compose up --build
```
