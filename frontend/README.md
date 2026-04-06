# Frontend

React + TypeScript + Vite + Leaflet + Tailwind CSS.

## Setup

Frontend запускается из **backend** репозитория через docker compose. Отдельно клонировать не нужно — backend уже ссылается на эту папку.

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

### 2. Start (from backend/)

```bash
cd backend
docker compose up -d
```

### 3. Open

http://localhost:8080

**IMPORTANT**: Рекомендуется открывать `localhost:8080` (единая точка входа через API Gateway).
`localhost:3000` тоже поддерживается: frontend nginx проксирует `/api/auth`, `/api/map`, `/api/admin` во внутренние сервисы.

### Default admin account

- **Email**: `admin@kzmap.edu`
- **Password**: `admin123`

## Local dev (without Docker)

Для разработки без Docker, сначала запустите backend:

```bash
cd backend
docker compose up -d postgres redis auth-service map-service api-gateway
```

Затем:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
```

Output: `dist/`
