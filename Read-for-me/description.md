# Kazakhstan Interactive Map Platform

A comprehensive microservices-based educational platform for an interactive contour map of Kazakhstan, featuring user authentication, map editing capabilities, and geographic object management.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Services & Ports](#services--ports)
- [Features](#features)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Frontend Routes](#frontend-routes)
- [Geographic Object Types](#geographic-object-types)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Development](#development)

---

## Architecture Overview

The platform follows a microservices architecture with the following components:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway (Nginx)                             │
│                                  Port 8080                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│    Auth Service        │  │     Map Service         │  │      Frontend           │
│    (Go + Gin)          │  │    (Go + Gin)           │  │  (React + TypeScript)   │
│    Port 8081           │  │    Port 8082            │  │    Port 3000            │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
              │                          │                          │
              └──────────────────────────┼──────────────────────────┘
                                         │
                                         ▼
              ┌──────────────────────────┴──────────────────────────┐
              │                                                         │
              ▼                                                         ▼
┌─────────────────────────┐                              ┌─────────────────────────┐
│    PostgreSQL +         │                              │         Redis           │
│    PostGIS              │                              │    (Cache)              │
│    Port 5432            │                              │    Port 6379            │
└─────────────────────────┘                              └─────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: [React](https://react.dev/) 18+
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Mapping Library**: [Leaflet](https://leafletjs.com/) + [React-Leaflet](https://react-leaflet.js.org/)
- **Drawing Tools**: [Leaflet Geoman](https://geoman.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: React Context + Zustand
- **Routing**: [React Router](https://reactrouter.com/) v6

### Backend Services
- **Language**: [Go](https://go.dev/) 1.21+
- **Web Framework**: [Gin](https://gin-gonic.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) 15+ with [PostGIS](https://postgis.net/)
- **Cache**: [Redis](https://redis.io/) 7+
- **API Gateway**: [Nginx](https://nginx.org/)

### Authentication
- **JWT**: Custom token-based authentication
- **OAuth**: Google OAuth 2.0 integration
- **Email Verification**: SMTP-based verification codes

---

## Services & Ports

| Service           | Port  | Description                              |
|-------------------|-------|------------------------------------------|
| API Gateway       | 8080  | Nginx reverse proxy                     |
| Frontend          | 3000  | React application                        |
| Auth Service      | 8081  | User authentication & management        |
| Map Service       | 8082  | Geographic objects & tiles              |
| PostgreSQL        | 5432  | Database (exposed as 5433)              |
| Redis             | 6379  | Cache (exposed as 6380)                 |

---

## Features

### User Authentication
- Email/password registration and login
- JWT-based session management with configurable expiry
- Google OAuth 2.0 integration for social login
- Email verification with SMTP
- Password reset functionality

### Role-Based Access Control
| Role    | Description                                    |
|---------|------------------------------------------------|
| `admin` | Full system access, user management           |
| `expert`| Map editing capabilities, object management    |
| `user`  | View-only access to the map                   |

### Interactive Map Viewer
- Leaflet-based map display with OpenStreetMap tiles
- Layer visibility controls for different object types
- Object property panel with details display
- Text search functionality for geographic objects
- Coordinate display widget
- Zoom picker for quick navigation

### Map Editor (Admin/Expert Only)
- Full drawing toolkit powered by Leaflet Geoman
- Create, edit, and delete geographic objects
- Layer management panel
- Property editor for object attributes
- Version history tracking
- Notes widget for annotations

### Geographic Object Management
- Support for multiple object types: rivers, lakes, mountains, cities, roads, boundaries, forests, buildings
- Scope management: global (public) or private objects
- JSON metadata support for custom attributes
- Full CRUD operations via REST API

### Version History
- Automatic versioning on object updates
- History tracking with change descriptions
- Rollback capability to previous versions
- Visual comparison between versions

### Complaint/Feedback System
- Users can submit complaints about map objects
- Status tracking: pending → in_review → resolved/dismissed
- Admin notes for resolution tracking
- Object association for context

### Admin Dashboard
- User management (create, update, delete, impersonate)
- Complaint management and resolution
- Statistics and analytics
- System health monitoring

---

## Database Schema

### Core Tables

#### `users`
| Column        | Type              | Description                    |
|---------------|-------------------|--------------------------------|
| id            | UUID              | Primary key                    |
| email         | VARCHAR(255)      | Unique email address           |
| password_hash | VARCHAR(255)      | Bcrypt hashed password         |
| role          | VARCHAR(50)       | admin, expert, or user         |
| first_name    | VARCHAR(100)      | User's first name              |
| last_name     | VARCHAR(100)      | User's last name               |
| nickname      | VARCHAR(100)      | User's display name           |
| created_at    | TIMESTAMP         | Account creation time          |
| updated_at    | TIMESTAMP         | Last profile update            |

#### `geo_objects`
| Column      | Type           | Description                    |
|-------------|----------------|--------------------------------|
| id          | UUID           | Primary key                    |
| owner_id    | UUID           | Foreign key to users           |
| scope       | VARCHAR(20)    | global or private              |
| type        | VARCHAR(50)    | Object type                    |
| name        | VARCHAR(255)   | Object name                    |
| description | TEXT           | Object description             |
| metadata    | JSONB          | Custom attributes              |
| geometry    | GEOMETRY       | PostGIS geometry (4326)        |
| created_at  | TIMESTAMP      | Creation time                  |
| updated_at  | TIMESTAMP      | Last modification               |

#### `complaints`
| Column       | Type           | Description                    |
|--------------|----------------|--------------------------------|
| id           | UUID           | Primary key                    |
| user_id      | UUID           | Foreign key to users           |
| object_id    | UUID           | Foreign key to geo_objects     |
| object_type  | VARCHAR(50)    | Type of complained object      |
| description  | TEXT           | Complaint details              |
| status       | VARCHAR(20)    | pending, in_review, resolved   |
| admin_notes  | TEXT           | Admin resolution notes         |
| created_at   | TIMESTAMP      | Submission time                |
| updated_at   | TIMESTAMP      | Last status update             |

### Database Indexes

- **Spatial Index**: GIST index on `geometry` column for spatial queries
- **GIN Index**: On `metadata` JSONB column for metadata queries
- **BTree Indexes**: On `scope`, `owner_id`, `type` for filtering
- **Composite Index**: `(scope, owner_id, type)` for efficient retrieval

---

## API Endpoints

### Authentication Service (Port 8081)

#### Public Endpoints
```
POST   /api/auth/register           # Register new user
POST   /api/auth/login              # Login with email/password
POST   /api/auth/refresh            # Refresh JWT token
POST   /api/auth/verify/send        # Send verification code
POST   /api/auth/verify             # Verify email with code
GET    /api/auth/google/url        # Get Google OAuth URL
GET    /api/auth/google/callback    # Google OAuth callback
```

#### Protected Endpoints (Authenticated Users)
```
GET    /api/auth/me                 # Get current user profile
PUT    /api/auth/me                 # Update own profile
```

#### Admin Endpoints (Admin Only)
```
GET    /api/auth/users              # List all users (paginated)
POST   /api/auth/users              # Create new user
PUT    /api/auth/users/:id          # Update user
DELETE /api/auth/users/:id          # Delete user
POST   /api/auth/users/:id/impersonate  # Impersonate user
```

### Map Service (Port 8082)

#### Protected Endpoints (Authenticated Users)
```
# Geo Objects
POST   /api/map/objects             # Create geo object
GET    /api/map/objects              # List geo objects
GET    /api/map/objects/:id          # Get object by ID
PUT    /api/map/objects/:id          # Update object
DELETE /api/map/objects/:id          # Delete object

# Tiles
GET    /api/map/tiles/:z/:x/:y.pbf  # Get vector tile

# Version History
GET    /api/map/objects/:id/history     # Get object history
POST   /api/map/history/:historyId/rollback  # Rollback to version

# Statistics
GET    /api/map/stats               # Get map statistics

# Complaints
POST   /api/map/complaints          # Submit complaint
GET    /api/map/complaints          # List complaints (admin)
GET    /api/map/complaints/:id      # Get complaint details
PUT    /api/map/complaints/:id      # Update complaint status
```

---

## Frontend Routes

| Path           | Access            | Description                    |
|----------------|-------------------|--------------------------------|
| `/`            | Public            | Landing page                  |
| `/auth/google/callback` | Public  | OAuth callback handler        |
| `/map/*`       | Authenticated     | Map viewer (user+)            |
| `/editor/*`    | Expert/Admin      | Map editor                    |
| `/settings`    | Authenticated     | User settings                 |
| `/admin/*`     | Admin             | Admin dashboard                |

---

## Geographic Object Types

The platform supports the following geographic object types:

| Type        | Description                    |
|-------------|--------------------------------|
| `river`     | Rivers and streams             |
| `lake`      | Lakes and reservoirs           |
| `mountain`  | Mountains and peaks            |
| `city`      | Cities and settlements         |
| `road`      | Roads and highways             |
| `boundary`  | Administrative boundaries      |
| `forest`    | Forests and woodlands          |
| `building`  | Buildings and structures       |
| `other`     | Other geographic features      |

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/) v2+
- [Node.js](https://nodejs.org/) 18+ (for local frontend development)
- [Go](https://go.dev/) 1.21+ (for local backend development)

### Quick Start

1. **Clone the repository**
   ```bash
   cd awesomeProject
   ```

2. **Start all services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Verify services are running**
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:8080
   - Auth Service: http://localhost:8081/health
   - Map Service: http://localhost:8082/health

### Default Credentials

The system creates a default admin user on first startup:
- **Email**: admin@kzmap.edu
- **Password**: admin123

> **Warning**: Change the default admin password in production!

---

## Project Structure

```
awesomeProject/
├── auth-service/              # Authentication microservice
│   ├── cmd/
│   │   └── main.go           # Entry point
│   ├── internal/
│   │   ├── config/           # Configuration management
│   │   ├── dto/              # Data transfer objects
│   │   ├── handler/          # HTTP handlers
│   │   ├── middleware/       # Auth middleware
│   │   ├── model/            # Domain models
│   │   ├── repository/      # Database access
│   │   └── service/          # Business logic
│   ├── pkg/
│   │   └── jwt/              # JWT utilities
│   ├── go.mod
│   └── Dockerfile
│
├── map-service/              # Map data microservice
│   ├── cmd/
│   │   └── main.go           # Entry point
│   ├── internal/
│   │   ├── config/           # Configuration management
│   │   ├── dto/              # Data transfer objects
│   │   ├── handler/          # HTTP handlers
│   │   ├── middleware/       # Auth middleware
│   │   ├── model/            # Domain models
│   │   ├── repository/      # Database access
│   │   └── service/          # Business logic
│   ├── pkg/
│   │   └── geometry/         # Geometry utilities
│   ├── go.mod
│   └── Dockerfile
│
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/        # Admin dashboard components
│   │   │   ├── Editor/       # Map editor components
│   │   │   ├── Landing/       # Landing page components
│   │   │   ├── Layout/       # Layout components
│   │   │   ├── Map/          # Map components
│   │   │   ├── Settings/      # Settings page
│   │   │   ├── Viewer/       # Map viewer components
│   │   │   └── VersionHistory/ # Version history UI
│   │   ├── context/          # React contexts
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API service clients
│   │   ├── store/            # State management
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utility functions
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── nginx/                    # API Gateway configuration
│   └── nginx.conf            # Nginx configuration
│
├── database/                 # Database scripts
│   ├── schema.sql            # Main schema
│   ├── migrations/           # Database migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_geo_object_history.sql
│   │   ├── 003_user_profile_and_complaints.sql
│   │   └── 004_tile_performance.sql
│   └── 03-init_data.sh      # Initial data script
│
├── docker-compose.yml        # Docker Compose configuration
└── README.md                 # Project README
```

---

## Configuration

### Environment Variables

#### Auth Service
| Variable              | Default                                      | Description                    |
|-----------------------|---------------------------------------------|--------------------------------|
| `PORT`                | 8081                                        | Service port                   |
| `DB_HOST`             | postgres                                    | Database host                  |
| `DB_PORT`             | 5432                                        | Database port                  |
| `DB_NAME`             | kzmap                                       | Database name                  |
| `DB_USER`             | kzmap_user                                  | Database user                  |
| `DB_PASSWORD`         | kzmap_password                              | Database password              |
| `JWT_SECRET`          | (default secret)                            | JWT signing secret             |
| `JWT_EXPIRY_HOURS`    | 24                                          | Token expiry time              |
| `GOOGLE_CLIENT_ID`    | (default)                                    | Google OAuth client ID         |
| `GOOGLE_CLIENT_SECRET`| (default)                                    | Google OAuth client secret     |
| `SMTP_HOST`           | smtp.gmail.com                              | SMTP server host               |
| `SMTP_PORT`           | 587                                         | SMTP server port               |
| `SMTP_USERNAME`       | (empty)                                     | SMTP username                  |
| `SMTP_PASSWORD`       | (empty)                                     | SMTP password                  |
| `SMTP_FROM`           | noreply@freshmap.team                      | SMTP from address              |

#### Map Service
| Variable              | Default                                      | Description                    |
|-----------------------|---------------------------------------------|--------------------------------|
| `PORT`                | 8082                                        | Service port                   |
| `DB_HOST`             | postgres                                    | Database host                  |
| `DB_PORT`             | 5432                                        | Database port                  |
| `DB_NAME`             | kzmap                                       | Database name                  |
| `DB_USER`             | kzmap_user                                  | Database user                  |
| `DB_PASSWORD`         | kzmap_password                              | Database password              |
| `REDIS_URL`           | redis:6379                                  | Redis connection URL           |
| `JWT_SECRET`          | (default secret)                            | JWT validation secret          |

#### Frontend
| Variable              | Default                                      | Description                    |
|-----------------------|---------------------------------------------|--------------------------------|
| `VITE_API_URL`        | http://localhost:8080                        | API Gateway URL                |
| `VITE_AUTH_SERVICE_URL`| http://api-gateway                         | Auth service URL               |
| `VITE_MAP_SERVICE_URL`| http://api-gateway                         | Map service URL                |

---

## Development

### Local Development

#### Backend Services

1. **Start PostgreSQL and Redis**
   ```bash
   docker-compose up postgres redis
   ```

2. **Run Auth Service**
   ```bash
   cd auth-service
   go run cmd/main.go
   ```

3. **Run Map Service**
   ```bash
   cd map-service
   go run cmd/main.go
   ```

#### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Building for Production

```bash
# Build all services
docker-compose build

# Start in production mode
docker-compose up -d
```

### Database Migrations

Migrations are automatically applied on container startup via Docker Compose. To manually apply:

```bash
docker-compose exec postgres psql -U kzmap_user -d kzmap -f /docker-entrypoint-initdb.d/01-schema.sql
```

---

## License

This project is for educational purposes.
