# Fix Log — 2026-04-14

## Изменённые файлы

1. `map/.gitignore`
2. `map/docker-compose.yml`
3. `map/backend/docker-compose.yml`
4. `map/backend/auth-service/Dockerfile`
5. `map/backend/map-service/Dockerfile`
6. `map/backend/auth-service/cmd/main.go`
7. `map/backend/map-service/cmd/main.go`
8. `map/frontend/Dockerfile`
9. `map/frontend/.dockerignore`
10. `map/frontend/src/components/Editor/PropertiesPanel.tsx`
11. `map/frontend/src/components/Editor/LayersPanel.tsx`
12. `map/frontend/src/components/Viewer/ViewerLayersPanel.tsx`
13. `map/frontend/src/components/Viewer/ViewerPropertiesPanel.tsx`
14. `map/frontend/src/components/Map/VectorTileLayer.tsx`

---

## 1. `.gitignore`
**Причина:** merge conflict (delson vs HEAD) — пути к бинарникам

**До:**
```
# Go
bin/
<<<<<<< HEAD
backend/map-service/map-service
backend/auth-service/auth-service
=======
map-service/map-service
auth-service/auth-service

.plans/
.Read-for-me/
>>>>>>> delson
```

**После:**
```
# Go
bin/
backend/map-service/map-service
backend/auth-service/auth-service
```

---

## 2. `docker-compose.yml`
**Причина:** merge conflict (delson vs HEAD) — Google OAuth env vars. Версия delson содержала хардкод credentials.

**До:**
```yaml
<<<<<<< HEAD
      GOOGLE_CLIENT_ID: ${GOOGLE_OAUTH_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_OAUTH_CLIENT_SECRET}
      GOOGLE_REDIRECT_URL: http://localhost:3000/auth/google/callback
=======
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-802334362365-...}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-GOCSPX-...}
      GOOGLE_REDIRECT_URL: ${GOOGLE_REDIRECT_URL:-http://localhost:3000/auth/google/callback}
>>>>>>> delson
```

**После:**
```yaml
      GOOGLE_CLIENT_ID: ${GOOGLE_OAUTH_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_OAUTH_CLIENT_SECRET}
      GOOGLE_REDIRECT_URL: http://localhost:3000/auth/google/callback
```

---

## 3. `backend/docker-compose.yml`
**Причина:** merge conflict (diana vs HEAD) — логика запуска миграций и импорта geodata

**До:**
```yaml
      echo 'Checking database state...'
      count=$$(psql ... \"SELECT count(*) FROM information_schema.tables WHERE table_name = 'geo_objects';\")
      if [ $$count -eq 0 ]; then
        echo 'Database empty. Running migrations and import...'
        psql ... -f database/migrations/001_initial_schema.sql
        psql ... -f database/migrations/002_geo_object_history.sql
        psql ... -f database/migrations/003_user_profile_and_complaints.sql
        psql ... -f database/migrations/004_tile_performance.sql
        ./load_all_gpkg.sh
      else
        echo 'Database already initialized.'
      fi
```

**После (версия diana — более полная, идемпотентная, включает миграцию 005):**
```yaml
      echo 'Running all migrations (idempotent)...';
      psql ... -f database/migrations/001_initial_schema.sql;
      psql ... -f database/migrations/002_geo_object_history.sql;
      psql ... -f database/migrations/003_user_profile_and_complaints.sql;
      psql ... -f database/migrations/004_tile_performance.sql;
      psql ... -f database/migrations/005_area_metadata.sql;
      echo 'Migrations done.';
      if [ -f gpkg_data/kazakhstan.gpkg ]; then
        count=$$(psql ... \"SELECT count(*) FROM geo_objects;\");
        if [ $$count -lt 500000 ]; then
          DB_HOST=postgres DB_PORT=5432 ./load_all_gpkg.sh;
        else
          echo \"Already have $$count objects, skipping import.\";
        fi;
      else
        echo 'No gpkg file found.';
      fi;
```

---

## 4. `backend/auth-service/Dockerfile`
**Причина:** DNS внутри Docker не работает — `apk add` и `go mod download` падали с network error

**До:**
```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /auth-service ./cmd/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /auth-service .
EXPOSE 8081
CMD ["./auth-service"]
```

**После:**
```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
COPY vendor/ vendor/
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o /auth-service ./cmd/main.go

FROM alpine:latest
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /app
COPY --from=builder /auth-service .
EXPOSE 8081
CMD ["./auth-service"]
```

**Что изменилось:**
- `go mod download` → `COPY vendor/ vendor/` + `-mod=vendor` (без сети)
- `RUN apk add ca-certificates tzdata` → `COPY --from=builder /etc/ssl/certs/ca-certificates.crt` (без сети)
- tzdata встроен в бинарник через `_ "time/tzdata"` (см. п.6)

---

## 5. `backend/map-service/Dockerfile`
**Причина:** `apk add` в финальном стейдже падал из-за DNS

**До:**
```dockerfile
FROM golang:1.21-alpine AS builder
RUN apk --no-cache add ca-certificates tzdata   # <- было добавлено, но тоже падало

WORKDIR /app
COPY go.mod go.sum ./
COPY vendor/ vendor/
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o /map-service ./cmd/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata   # <- оригинальная строка, падала

WORKDIR /app
COPY --from=builder /map-service .
EXPOSE 8082
CMD ["./map-service"]
```

**После:**
```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
COPY vendor/ vendor/
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o /map-service ./cmd/main.go

FROM alpine:latest
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

WORKDIR /app
COPY --from=builder /map-service .
EXPOSE 8082
CMD ["./map-service"]
```

---

## 6. `backend/auth-service/cmd/main.go`
**Причина:** tzdata убран из Dockerfile — нужно встроить в бинарник

**До:**
```go
import (
    "fmt"
    "log"
    "time"

    "auth-service/internal/config"
    ...
)
```

**После:**
```go
import (
    "fmt"
    "log"
    "time"
    _ "time/tzdata"

    "auth-service/internal/config"
    ...
)
```

---

## 7. `backend/map-service/cmd/main.go`
**Причина:** tzdata убран из Dockerfile — нужно встроить в бинарник

**До:**
```go
import (
    "fmt"
    "log"
    "time"

    "map-service/internal/config"
    ...
)
```

**После:**
```go
import (
    "fmt"
    "log"
    "time"
    _ "time/tzdata"

    "map-service/internal/config"
    ...
)
```

---

## 8. `frontend/Dockerfile`
**Причина:** `npm install` падал внутри Docker из-за DNS — пакеты не скачивались, `npm run build` возвращал код 127 (команда не найдена)

**До:**
```dockerfile
# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .
```

**После:**
```dockerfile
# Copy package files and pre-installed node_modules (offline build)
COPY package.json package-lock.json ./
COPY node_modules/ node_modules/

# Copy source code
COPY . .
```

**Что изменилось:** `RUN npm install` убран — `node_modules` копируется с хоста (уже установлен локально)

---

## 9. `frontend/.dockerignore`
**Причина:** `node_modules` был в игноре, поэтому Docker не мог его скопировать

**До:**
```
node_modules
dist
...
```

**После:**
```
# node_modules included for offline Docker build
dist
...
```

---

## 10–11. `Editor/PropertiesPanel.tsx` и `Editor/LayersPanel.tsx`
**Причина:** панели были полупрозрачными с тяжёлым blur-эффектом (`backdrop-blur-3xl`) — выглядели мыльно

**До:**
```
bg-[#020C1B]/75 backdrop-blur-3xl
```

**После:**
```
bg-[#020C1B]
```

Также в `PropertiesPanel.tsx` убран тип `custom` из выпадающего списка классификации:

**До:**
```ts
const FEATURE_CLASSES = ['lake', 'river', 'forest', 'road', 'other', 'custom']
```

**После:**
```ts
const FEATURE_CLASSES = ['lake', 'river', 'forest', 'road', 'other']
```

В `LayersPanel.tsx` добавлен `custom` в скрытые типы:

**До:**
```ts
const DISABLED_TYPES = new Set(['building', 'city'])
```

**После:**
```ts
const DISABLED_TYPES = new Set(['building', 'city', 'custom'])
```

---

## 12–13. `Viewer/ViewerLayersPanel.tsx` и `Viewer/ViewerPropertiesPanel.tsx`
**Причина:** те же blur-проблемы в viewer

**До:** `bg-[#020C1B]/75 backdrop-blur-3xl`

**После:** `bg-[#020C1B]`

В `ViewerPropertiesPanel.tsx` убраны `building`, `city`, `custom` из локального `CLASS_LABELS`:

**До:**
```ts
{ lake, river, forest, road, building, city, mountain, boundary, other, custom }
```

**После:**
```ts
{ lake, river, forest, road, mountain, boundary, other }
```

---

## 14. `Map/VectorTileLayer.tsx`
**Причина:** `custom` тип рендерился на карте, хотя убран из UI

**До:**
```ts
const DISABLED_TYPES = new Set(['building', 'city'])
```

**После:**
```ts
const DISABLED_TYPES = new Set(['building', 'city', 'custom'])
