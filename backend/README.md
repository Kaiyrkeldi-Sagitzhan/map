# Backend

Auth service (Go), Map service (Go), API Gateway (Nginx), PostgreSQL + PostGIS, Redis.

## Setup

### 1. Clone both repos side by side

```bash
git clone https://10.1.14.25:8091/topography/backend.git
git clone https://10.1.14.25:8091/topography/frontend.git
```

Structure:
```
project/
  backend/
  frontend/
```

### 2. Download geodata (~400MB, ~4 million objects)

```bash
cd backend
mkdir -p gpkg_data
wget -O gpkg_data/kazakhstan-latest-free.gpkg.zip \
  https://download.geofabrik.de/asia/kazakhstan-latest-free.gpkg.zip
unzip gpkg_data/kazakhstan-latest-free.gpkg.zip -d gpkg_data/
mv gpkg_data/kazakhstan-latest-free.gpkg gpkg_data/kazakhstan.gpkg
```

### 3. Create .env

```bash
cp .env.example .env
```

Edit `.env` — set `JWT_SECRET` to something random. Google OAuth and SMTP optional.

### 4. Start all services

```bash
docker compose up -d
```

Database migrations run automatically on first start.

### 5. Load full map data (IMPORTANT — first time only)

```bash
./load_all_gpkg.sh
```

This imports ALL OpenStreetMap data (~4 million objects) into PostGIS.
Takes 10-30 minutes depending on your machine. Without this step you will only have ~280k objects from the base dump.

### 6. Open the site

http://localhost:8080

### Default admin account

- **Email**: `admin@kzmap.edu`
- **Password**: `admin123`

## Ports

| Service | URL | Description |
|---------|-----|-------------|
| **http://localhost:8080** | Main | Frontend + API (use this) |
| http://localhost:8081 | Internal | Auth Service |
| http://localhost:8082 | Internal | Map Service |
| http://localhost:5433 | Internal | PostgreSQL |
| http://localhost:6380 | Internal | Redis |

## API

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Login (returns JWT token) |
| `POST /api/auth/register` | Register new user |
| `GET /api/auth/me` | Current user profile |
| `GET /api/map/objects` | List geo objects |
| `GET /api/map/tiles/{z}/{x}/{y}.pbf` | Vector tiles |
| `GET /api/map/stats` | Map statistics |

## .env variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | yes | JWT signing key (any random string) |
| `GOOGLE_CLIENT_ID` | no | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | no | Google OAuth |
| `SMTP_HOST` | no | Email verification |
| `SMTP_USERNAME` | no | Email verification |
| `SMTP_PASSWORD` | no | Email verification |
