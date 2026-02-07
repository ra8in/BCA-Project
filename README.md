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

2. **Start the Application**:
   ```bash
   docker-compose up --build
   ```
   *Note: The first run may take a few minutes to build images and seed the database.*

3. **Access the App**:
   - **Frontend**: http://localhost:5173
   - **Backend Admin**: http://localhost:8000/admin
     - **Username**: `admin`
     - **Password**: `admin123` (Created automatically if missing)

4. **Stop the App**:
   Press `Ctrl+C` or run:
   ```bash
   docker-compose down
   ```

## 📊 Data Management

### Automatic Seeding
This project is configured to **automatically seed** the database with market data (Indices, Stocks, Sectors) when it starts with an empty database.
- **Source File**: `docs/sharehub_home_data.json`
- **Logic**: If the database is empty, the system reads this JSON file and populates the `Stock`, `StockPrice`, and `MarketIndex` tables.

### How to Update Seed Data
To share new market data with the team:
1. Update `docs/sharehub_home_data.json` with the new JSON structure.
2. Commit and push the file to GitHub.
3. Teammates can receive the update by resetting their database:
   ```bash
   docker-compose down -v  # WARNING: Deletes local users/portfolios!
   docker-compose up --build
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
