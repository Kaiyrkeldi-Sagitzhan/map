# Technologies Used in Kazakhstan Interactive Map Platform

This document lists all technologies, frameworks, libraries, and tools used in the Kazakhstan Interactive Map Platform project.

## Table of Contents

- [Frontend](#frontend)
  - [Core Framework](#core-framework)
  - [State Management](#state-management)
  - [UI & Styling](#ui--styling)
  - [Mapping & Geospatial](#mapping--geospatial)
  - [Visualization & Animation](#visualization--animation)
  - [Utilities](#utilities)
- [Backend](#backend)
  - [Core Languages](#core-languages)
  - [Web Frameworks](#web-frameworks)
  - [Database](#database)
  - [Caching](#caching)
  - [Authentication](#authentication)
- [DevOps & Infrastructure](#devops--infrastructure)
  - [Containerization](#containerization)
  - [Orchestration](#orchestration)
  - [Web Server](#web-server)
- [Development Tools](#development-tools)
  - [Build Tools](#build-tools)
  - [Package Managers](#package-managers)
- [Architecture](#architecture)

---

## Frontend

### Core Framework

- **[React 18](https://react.dev/)** - JavaScript library for building user interfaces
  - Version: ^18.2.0
  - Used for building component-based UI

- **[TypeScript](https://www.typescriptlang.org/)** - Typed superset of JavaScript
  - Version: ^5.3.3
  - Provides type safety and enhanced developer experience

### State Management

- **[Zustand](https://github.com/pmndrs/zustand)** - Lightweight state management solution
  - Version: ^5.0.11
  - Used for managing application state (viewerStore, editorStore, adminStore)

### UI & Styling

- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
  - Version: ^3.4.17
  - Rapid UI development with utility classes

- **[PostCSS](https://postcss.org/)** - CSS transformation tool
  - Version: ^8.4.49
  - Processes Tailwind CSS

- **[Autoprefixer](https://autoprefixer.github.io/)** - PostCSS plugin for vendor prefixing
  - Version: ^10.4.20
  - Automatically adds vendor prefixes to CSS

### Mapping & Geospatial

- **[Leaflet](https://leafletjs.com/)** - Open-source JavaScript library for mobile-friendly interactive maps
  - Version: ^1.9.4
  - Core mapping library for displaying geographic data

- **[React-Leaflet](https://react-leaflet.js.org/)** - React components for Leaflet
  - Version: ^4.2.1
  - React integration for Leaflet maps

- **[@geoman-io/leaflet-geoman-free](https://github.com/geoman-io/leaflet-geoman)** - Leaflet plugin for drawing and editing geometry layers
  - Version: ^2.19.2
  - Provides drawing tools for creating/editing geographic objects (Point, Line, Polygon)

- **[Leaflet.VectorGrid](https://github.com/Leaflet/Leaflet.VectorGrid)** - Display vector tiles in Leaflet
  - Version: ^1.3.0
  - Used for rendering vector tile layers

- **[GeoJSON](https://github.com/juliuste/geojson)** - GeoJSON parser and stringifier
  - Version: ^0.5.0
  - Handles GeoJSON data format

- **[PBF](https://github.com/mapbox/pbf)** - Protocol Buffers implementation for JavaScript
  - Version: ^3.2.1
  - Used for parsing vector tile data

### Visualization & Animation

- **[globe.gl](https://github.com/vasturiano/globe.gl)** - WebGL-powered 3D globe visualization
  - Version: ^2.45.0
  - Used for 3D globe display in landing page

- **[react-globe.gl](https://github.com/vasturiano/react-globe.gl)** - React bindings for globe.gl
  - Version: ^2.37.0
  - React integration for 3D globe

- **[GSAP (GreenSock Animation Platform)](https://greensock.com/gsap/)** - Professional-grade JavaScript animation library
  - Version: ^3.14.2
  - Used for advanced animations and transitions

- **[Anime.js](https://animejs.com/)** - Lightweight JavaScript animation library
  - Version: ^4.3.6
  - Used for UI animations

- **[Recharts](https://recharts.org/)** - Composable charting library built on React components
  - Version: ^3.8.0
  - Used for data visualization in admin dashboard

### Utilities

- **[Axios](https://axios-http.com/)** - Promise-based HTTP client
  - Version: ^1.6.5
  - Used for API requests to backend services

- **[JWT-Decode](https://github.com/auth0/jwt-decode)** - Decode JWT tokens
  - Version: ^4.0.0
  - Used for decoding authentication tokens

- **[File-Saver](https://github.com/eligrey/FileSaver.js/)** - Save files on the client side
  - Version: ^2.0.5
  - Used for exporting/downloading files

- **[Xterm.js](https://xtermjs.org/)** - Terminal frontend component
  - Version: ^6.0.0
  - Used for terminal/console UI components

- **[Xterm Addon Fit](https://github.com/xtermjs/xterm.js/tree/master/addons/fit)** - Xterm.js fit addon
  - Version: ^0.11.0
  - Auto-resizes terminal to fit container

- **[Lodash](https://lodash.com/)** - JavaScript utility library
  - Version: ^4.17.23
  - Provides utility functions for common programming tasks

- **[Lucide React](https://lucide.dev/)** - Beautiful & consistent icon toolkit
  - Version: ^0.468.0
  - Icon library for React applications

---

## Backend

### Core Languages

- **[Go (Golang)](https://go.dev/)** - Statically typed, compiled programming language
  - Version: 1.21
  - Used for building microservices (auth-service, map-service)

### Web Frameworks

- **[Gin](https://gin-gonic.com/)** - High-performance HTTP web framework for Go
  - Version: v1.9.1
  - Used in both auth-service and map-service for building RESTful APIs

### Database

- **[PostgreSQL](https://www.postgresql.org/)** - Open-source relational database
  - Version: 15 (via postgis/postgis:15-3.3 image)
  - Primary database for storing user data and geographic objects

- **[PostGIS](https://postgis.net/)** - Spatial database extender for PostgreSQL
  - Version: 3.3
  - Provides geographic object support for PostgreSQL
  - Enables spatial queries and geographic data operations

- **[Redis](https://redis.io/)** - In-memory data structure store
  - Version: 7-alpine
  - Used for caching map tiles and improving performance

### Authentication

- **[JWT (JSON Web Tokens)](https://jwt.io/)** - Open standard for access tokens
  - Library: github.com/golang-jwt/jwt/v5 (v5.2.0)
  - Used for stateless authentication between frontend and backend

- **[OAuth 2.0](https://oauth.net/2/)** - Authorization framework
  - Implemented for Google OAuth integration
  - Enables social login functionality

### Database Drivers & Libraries

- **[lib/pq](https://github.com/lib/pq)** - Pure Go Postgres driver for database/sql
  - Version: v1.10.9
  - PostgreSQL driver for Go

- **[sqlx](https://github.com/jmoiron/sqlx)** - General purpose extensions to Go's database/sql
  - Version: v1.3.5
  - Provides enhanced database operations with struct mapping

- **[go-redis](https://github.com/redis/go-redis)** - Redis client for Go
  - Version: v9.18.0
  - Used for Redis caching operations

- **[google/uuid](https://github.com/google/uuid)** - UUID library for Go
  - Version: v1.5.0
  - Used for generating unique identifiers

- **[golang-jwt/jwt](https://github.com/golang-jwt/jwt)** - JWT implementation for Go
  - Version: v5.2.0
  - Used for JWT token generation and validation

---

## DevOps & Infrastructure

### Containerization

- **[Docker](https://www.docker.com/)** - Platform for developing, shipping, and running applications in containers
  - Used for containerizing all services (frontend, auth-service, map-service, postgres, redis)

- **[Nginx](https://www.nginx.com/)** - Web server and reverse proxy
  - Used as API gateway and for serving frontend in production

### Orchestration

- **[Docker Compose](https://docs.docker.com/compose/)** - Tool for defining and running multi-container Docker applications
  - Used for local development and deployment orchestration
  - Multiple compose files: docker-compose.yml, docker-compose.backend.yml, docker-compose.frontend.yml, docker-compose.webhook.yml

---

## Development Tools

### Build Tools

- **[Vite](https://vitejs.dev/)** - Next-generation frontend build tool
  - Version: ^5.0.11
  - Fast build tool and development server for frontend

### Package Managers

- **[npm](https://www.npmjs.com/)** - Package manager for JavaScript
  - Used for managing frontend dependencies

- **[Go Modules](https://go.dev/ref/mod)** - Go's dependency management system
  - Used for managing Go dependencies (go.mod, go.sum)

---

## Architecture

### Microservices Architecture

The platform follows a microservices architecture with the following services:

1. **Frontend Service** - React SPA served via Nginx
2. **Auth Service** - Go microservice handling authentication and authorization
3. **Map Service** - Go microservice handling geographic object management
4. **Database Service** - PostgreSQL with PostGIS extension
5. **Cache Service** - Redis for caching
6. **Webhook Service** - Go service for webhook handling

### Design Patterns

- **Repository Pattern** - Abstracts data layer operations
- **Service Layer Pattern** - Business logic encapsulation
- **Handler Pattern** - HTTP request/response handling
- **Middleware Pattern** - Cross-cutting concerns (authentication, CORS)
- **DTO Pattern** - Data Transfer Objects for API communication

### API Design

- **RESTful API** - Resource-oriented API design
- **JSON** - Primary data interchange format
- **OpenAPI/Swagger** - API documentation (see swagger/ directory)

---

## Additional Technologies

### Spatial Data Formats

- **[GeoJSON](https://geojson.org/)** - Format for encoding geographic data structures
- **[Protocol Buffers](https://developers.google.com/protocol-buffers)** - Binary serialization format for vector tiles
- **[Shapefile](https://en.wikipedia.org/wiki/Shapefile)** - Esri's vector data format (via .gpkg files)

### Development Utilities

- **Shell Scripts** - Automation scripts (build/rebuild.sh, load_all_gpkg.sh)
- **SQL** - Database schema and migrations
- **Git** - Version control system

### Testing & Validation

- **JavaScript** - Verification scripts (verify-multiselect.js)

---

## Version Information

| Technology | Version | Usage |
|------------|---------|-------|
| React | ^18.2.0 | Frontend UI library |
| TypeScript | ^5.3.3 | Type-safe JavaScript |
| Go | 1.21 | Backend services |
| Gin | v1.9.1 | Web framework |
| PostgreSQL | 15 | Database |
| PostGIS | 3.3 | Spatial database |
| Redis | 7-alpine | Caching |
| Leaflet | ^1.9.4 | Interactive maps |
| Tailwind CSS | ^3.4.17 | Styling framework |
| Vite | ^5.0.11 | Build tool |
| Docker | Latest | Containerization |
| JWT | v5.2.0 | Authentication tokens |

---

## License Information

All technologies listed are used in accordance with their respective open-source licenses. The project itself is developed for educational purposes related to geography education in Kazakhstan.