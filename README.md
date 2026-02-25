# Kazakhstan Interactive Map Platform

A production-ready microservices-based educational platform for an interactive contour map of Kazakhstan for geography education.

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                │
│               (React + TypeScript + Leaflet)                    │
│                         Port: 3000                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     API Gateway (Nginx)                        │
│                         Port: 8080                              │
└──────────┬──────────────────────┬──────────────────────────────┘
           │                      │
┌──────────▼──────────┐  ┌────────▼─────────────────────────────────┐
│  Auth Service      │  │  Map Service                           │
│  (Go + Gin)        │  │  (Go + Gin)                           │
│  Port: 8081        │  │  Port: 8082                           │
└─────────┬──────────┘  └────────┬────────────────────────────────┘
          │                    │
┌─────────▼────────────────────▼────────────────────────────────┐
│                   PostgreSQL + PostGIS                        │
│                         Port: 5432                            │
└────────────────────────────────────────────────────────────────┘
```

### Microservices Folder Structure

```
awesomeProject/
├── auth-service/                  # Authentication microservice
│   ├── cmd/
│   │   └── main.go               # Entry point
│   ├── internal/
│   │   ├── config/               # Configuration management
│   │   ├── dto/                  # Data Transfer Objects
│   │   ├── handler/              # HTTP handlers
│   │   ├── middleware/           # JWT, CORS middleware
│   │   ├── model/                # Domain models
│   │   ├── repository/           # Database operations
│   │   └── service/              # Business logic
│   ├── pkg/
│   │   └── jwt/                  # JWT token management
│   ├── Dockerfile
│   └── go.mod
│
├── map-service/                   # Map/Geo object microservice
│   ├── cmd/
│   │   └── main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── dto/
│   │   ├── handler/
│   │   ├── middleware/
│   │   ├── model/
│   │   ├── repository/
│   │   └── service/
│   ├── pkg/
│   │   └── geometry/             # PostGIS geometry utilities
│   ├── Dockerfile
│   └── go.mod
│
├── frontend/                      # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/             # Login, Register
│   │   │   ├── Layout/           # Main layout
│   │   │   └── Map/              # Map components
│   │   ├── context/             # Auth context
│   │   ├── services/             # API service layer
│   │   ├── types/                # TypeScript types
│   │   └── assets/               # Kazakhstan GeoJSON
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
│
├── database/
│   ├── schema.sql                # Database schema
│   └── migrations/               # Migration files
│
├── nginx/                        # API Gateway config
│   └── nginx.conf
│
├── docker-compose.yml            # Docker orchestration
└── README.md
```

## Database Design

### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Geo Objects Table

```sql
CREATE TABLE geo_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'private')),
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_geo_objects_geometry ON geo_objects USING GIST (geometry);
CREATE INDEX idx_geo_objects_metadata ON geo_objects USING GIN (metadata);
CREATE INDEX idx_geo_objects_scope ON geo_objects (scope);
CREATE INDEX idx_geo_objects_owner ON geo_objects (owner_id);
CREATE INDEX idx_geo_objects_type ON geo_objects (type);
CREATE INDEX idx_geo_objects_scope_owner_type ON geo_objects (scope, owner_id, type);
```

## Security Requirements

### JWT Authentication

- All protected routes require JWT token in Authorization header
- Token format: `Bearer <token>`
- JWT contains: user_id, email, role
- Token expiry: 24 hours (configurable)

### Role-Based Access Control (RBAC)

**Roles:**
- `admin`: Can create/edit/delete global objects
- `user`: Can create/edit/delete personal objects

**Scope Validation:**
- `global`: Visible to all users, editable only by admins
- `private`: Visible/editable only by owner

## API Endpoints

### Auth Service (Port 8081)

```
POST /api/auth/register     - Register new user
POST /api/auth/login        - Login user
POST /api/auth/refresh     - Refresh token
GET  /api/auth/me          - Get current user (protected)
```

### Map Service (Port 8082)

```
GET    /api/map/objects           - Get all accessible objects (protected)
GET    /api/map/objects/:id       - Get object by ID (protected)
POST   /api/map/objects           - Create new object (protected)
PUT    /api/map/objects/:id       - Update object (protected)
DELETE /api/map/objects/:id       - Delete object (protected)
```

## Example API Responses

### Login Request

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Login Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "user",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Create Geo Object Request

```http
POST /api/map/objects
Authorization: Bearer <token>
Content-Type: application/json

{
  "scope": "private",
  "type": "river",
  "name": "Irtysh River",
  "description": "Major river in Kazakhstan",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [75.5, 48.0],
      [76.0, 47.5],
      [76.5, 47.0],
      [77.0, 46.5]
    ]
  }
}
```

### Create Geo Object Response

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "owner_id": "550e8400-e29b-41d4-a716-446655440000",
  "scope": "private",
  "type": "river",
  "name": "Irtysh River",
  "description": "Major river in Kazakhstan",
  "metadata": {},
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [75.5, 48.0],
      [76.0, 47.5],
      [76.5, 47.0],
      [77.0, 46.5]
    ]
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Get Objects Response

```json
{
  "objects": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "owner_id": null,
      "scope": "global",
      "type": "lake",
      "name": "Lake Balkhash",
      "description": "Large lake in Kazakhstan",
      "metadata": {},
      "geometry": {
        "type": "Polygon",
        "coordinates": [[...]]
      },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "owner_id": "550e8400-e29b-41d4-a716-446655440000",
      "scope": "private",
      "type": "mountain",
      "name": "Khan Tengri",
      "description": "Mountain peak",
      "metadata": {},
      "geometry": {
        "type": "Point",
        "coordinates": [80.0, 42.0]
      },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 2
}
```

## Drawing Flow Sequence Diagram

### Admin User Flow (Global Object)

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌───────────┐    ┌─────────┐
│  Admin  │    │Frontend │    │  Nginx   │    │Map Service│    │PostgreSQL│
└────┬────┘    └────┬────┘    └────┬─────┘    └─────┬─────┘    └────┬────┘
     │              │              │                │               │
     │1.Draw on map│              │                │               │
     │─────────────>│              │                │               │
     │              │2.Select type │                │               │
     │─────────────>│              │                │               │
     │              │3.Submit data │                │               │
     │              │─────────────>│                │               │
     │              │              │4.JWT valid.   │               │
     │              │              │──────────────>│               │
     │              │              │                │5.Check admin │
     │              │              │                │───────┐      │
     │              │              │                │       │      │
     │              │              │                │6.Store global│
     │              │              │                │───────────>│
     │              │              │                │            │
     │              │              │7.Success      │            │
     │              │              │<──────────────│            │
     │              │8.Success     │               │            │
     │<─────────────│              │               │            │
     │              │9.Render on map              │            │
     │─────────────>│              │               │            │
```

### Regular User Flow (Private Object)

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌───────────┐    ┌─────────┐
│  User   │    │Frontend │    │  Nginx   │    │Map Service│    │PostgreSQL│
└────┬────┘    └────┬────┘    └────┬─────┘    └─────┬─────┘    └────┬────┘
     │              │              │                │               │
     │1.Draw on map│              │                │               │
     │─────────────>│              │                │               │
     │              │2.Select type │                │               │
     │─────────────>│              │                │               │
     │              │3.Submit data │                │               │
     │              │─────────────>│                │               │
     │              │              │4.JWT valid.   │               │
     │              │              │──────────────>│               │
     │              │              │                │5.Check scope │
     │              │              │                │───────┐      │
     │              │              │                │       │      │
     │              │              │                │6.Store private│
     │              │              │                │owner_id=user │
     │              │              │                │───────────>│
     │              │              │                │            │
     │              │              │7.Success      │            │
     │              │              │<──────────────│            │
     │              │8.Success     │               │            │
     │<─────────────│              │               │            │
     │              │9.Render on personal map     │            │
     │─────────────>│              │               │            │
```

## Layered Optimization Explanation

### Frontend Layer Optimization

1. **Layer Visibility Toggle**
   - Users can toggle visibility of each object type (rivers, lakes, mountains, regions)
   - Only visible layers are rendered on the map
   - Reduces DOM nodes and improves rendering performance

2. **Lazy Loading**
   - Objects are fetched on component mount
   - Type filtering can be applied on server-side to reduce payload

3. **GeoJSON Optimization**
   - Kazakhstan boundary is loaded separately as static GeoJSON
   - User objects are loaded as separate layers

### Backend Layer Optimization

1. **Database Indexing**
   - GIST index on geometry column for spatial queries
   - GIN index on metadata JSONB for fast metadata queries
   - Composite index on (scope, owner_id, type) for efficient filtering

2. **Query Optimization**
   - Separate queries for different object types
   - Filter by scope and owner_id at database level
   - Use ST_AsGeoJSON for efficient GeoJSON conversion

3. **Connection Pooling**
   - Database connections are pooled
   - Prepared statements for frequently used queries

## Running the Application

### Prerequisites
- Docker and Docker Compose
- Make (optional)

### Start all services

```bash
# Using Docker Compose
docker-compose up -d

# Or with Make
make up
```

### Access the application

- Frontend: http://localhost:3000
- API Gateway: http://localhost:8080
- Auth Service: http://localhost:8081
- Map Service: http://localhost:8082
- PostgreSQL: localhost:5432

### Default Admin Credentials

- Email: admin@kzmap.edu
- Password: admin123

## Development

### Environment Variables

```env
# Auth Service
PORT=8081
DB_HOST=postgres
DB_PORT=5432
DB_NAME=kzmap
DB_USER=kzmap_user
DB_PASSWORD=kzmap_password
JWT_SECRET=your-secret-key
JWT_EXPIRY_HOURS=24

# Map Service
PORT=8082
DB_HOST=postgres
DB_PORT=5432
DB_NAME=kzmap
DB_USER=kzmap_user
DB_PASSWORD=kzmap_password
JWT_SECRET=your-secret-key

# Frontend
VITE_API_URL=http://localhost:8080
VITE_AUTH_SERVICE_URL=http://localhost:8081
VITE_MAP_SERVICE_URL=http://localhost:8082
```

### Build Services

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build auth-service
docker-compose build map-service
docker-compose build frontend
```

### View Logs

```bash
docker-compose logs -f
docker-compose logs -f auth-service
docker-compose logs -f map-service
docker-compose logs -f frontend
```

### Stop Services

```bash
docker-compose down
docker-compose down -v  # with volumes
```

## Technologies Used

### Backend
- **Go 1.21**: Modern Go with native HTTP server
- **Gin**: High-performance HTTP web framework
- **PostgreSQL + PostGIS**: Spatial database
- **JWT**: Secure authentication
- **bcrypt**: Password hashing

### Frontend
- **React 18**: UI library
- **TypeScript**: Type safety
- **Leaflet**: Interactive maps
- **Leaflet Draw**: Drawing tools
- **Vite**: Build tool
- **Axios**: HTTP client
- **React Router**: Client-side routing

### Infrastructure
- **Docker**: Containerization
- **Nginx**: API Gateway and reverse proxy
- **PostGIS**: Geospatial extensions for PostgreSQL
