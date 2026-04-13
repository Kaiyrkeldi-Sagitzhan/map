# Kazakhstan Interactive Map Platform

A production-ready microservices-based educational platform for an interactive contour map of Kazakhstan for geography education.

## Table of Contents

1. [MVP (Minimum Viable Product)](#mvp-minimum-viable-product)
2. [Architecture Overview](#architecture-overview)
3. [Use Case Diagrams](#use-case-diagrams)
4. [Sequence Diagrams](#sequence-diagrams)
5. [Class Diagrams](#class-diagrams)
6. [Component Architecture](#component-architecture)
7. [Database Design](#database-design)
8. [Security Requirements](#security-requirements)
9. [API Endpoints](#api-endpoints)
10. [Running the Application](#running-the-application)
11. [Technologies Used](#technologies-used)

---

## MVP (Minimum Viable Product)

### Core Features

The MVP of the Kazakhstan Interactive Map Platform includes the following essential features:

#### 1. User Authentication System
- **User Registration**: Email/password registration with role assignment (admin, expert, user)
- **User Login**: JWT-based authentication with secure token management
- **OAuth Integration**: Google OAuth 2.0 support for quick authentication
- **Email Verification**: SMTP-based email verification for account activation
- **Profile Management**: Users can update their profile information

#### 2. Interactive Map Viewer
- **Base Map Display**: Interactive map of Kazakhstan using Leaflet.js
- **Layer Management**: Toggle visibility of different geographic object types (rivers, lakes, mountains, cities, roads, boundaries, forests, buildings)
- **Object Search**: Full-text search for geographic objects by name
- **Object Details**: View detailed information about selected objects
- **Coordinate Display**: Real-time coordinate display on mouse movement

#### 3. Map Editor (Admin/Expert only)
- **Drawing Tools**: Create new geographic objects using drawing tools (Point, Line, Polygon)
- **Object Editing**: Modify existing geographic objects
- **Object Deletion**: Remove geographic objects from the map
- **Properties Panel**: Edit object properties (name, description, type, scope)
- **Layer Panel**: Manage and organize geographic objects by type
- **Version Control**: Track changes to objects with version history

#### 4. Geographic Object Management
- **Object Types**: Support for multiple types - river, lake, mountain, city, road, boundary, forest, building, custom
- **Scope System**: 
  - `global` objects: Visible to all users, editable only by admins
  - `private` objects: Visible and editable only by the owner
- **Object Metadata**: JSONB-based metadata storage for extensibility
- **Spatial Queries**: PostGIS-powered spatial queries for geographic data

#### 5. Complaint/Feedback System
- **Submit Complaints**: Users can report inappropriate content
- **Complaint Tracking**: Track status of submitted complaints
- **Admin Review**: Admin interface for reviewing and managing complaints

#### 6. Admin Dashboard
- **User Management**: Admin can create, edit, delete users
- **Role Management**: Assign roles (admin, expert, user) to users
- **Statistics**: View platform statistics (object counts by type)
- **Complaint Management**: Review and resolve user complaints

### MVP User Stories

| User Story | Description | Priority |
|------------|-------------|----------|
| US-001 | As a visitor, I can register an account with email/password | Must Have |
| US-002 | As a registered user, I can log in and receive a JWT token | Must Have |
| US-003 | As a user, I can view the interactive map of Kazakhstan | Must Have |
| US-004 | As a user, I can search for geographic objects by name | Must Have |
| US-005 | As a user, I can toggle layer visibility | Must Have |
| US-006 | As a user, I can view object details by clicking | Must Have |
| US-007 | As an expert, I can draw new geographic objects | Must Have |
| US-008 | As an expert, I can edit existing geographic objects | Must Have |
| US-009 | As an expert, I can delete geographic objects | Must Have |
| US-010 | As a user, I can view version history of objects | Should Have |
| US-011 | As a user, I can submit complaints about content | Should Have |
| US-012 | As an admin, I can manage users and roles | Must Have |
| US-013 | As an admin, I can view platform statistics | Should Have |
| US-014 | As an admin, I can review and resolve complaints | Should Have |

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              KAZAKHSTAN INTERACTIVE MAP PLATFORM                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                              CLIENT LAYER                                     │   │
│  │                                                                               │   │
│  │   ┌─────────────────────────────────────────────────────────────────────┐    │   │
│  │   │                    React SPA (Port 3000)                             │    │   │
│  │   │                                                                     │    │   │
│  │   │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │    │   │
│  │   │   │   Landing   │ │   Viewer    │ │   Editor    │ │   Admin     │  │    │   │
│  │   │   │   Page      │ │   Mode      │ │   Mode      │ │   Panel     │  │    │   │
│  │   │   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │    │   │
│  │   │                                                                     │    │   │
│  │   │   ┌─────────────────────────────────────────────────────────────┐  │    │   │
│  │   │   │                    Context & State                          │  │    │   │
│  │   │   │   ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │  │    │   │
│  │   │   │   │ AuthContext │ │ EditorStore │ │   ViewerStore       │   │  │    │   │
│  │   │   │   └─────────────┘ └─────────────┘ └─────────────────────┘   │  │    │   │
│  │   │   └─────────────────────────────────────────────────────────────┘  │    │   │
│  │   │                                                                     │    │   │
│  │   └─────────────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                           │
│                                          ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                           API GATEWAY LAYER (Nginx)                          │   │
│  │                              Port: 8080                                       │   │
│  │                                                                               │   │
│  │   ┌─────────────────────────────────────────────────────────────────────┐    │   │
│  │   │                        Route Configuration                           │    │   │
│  │   │                                                                     │    │   │
│  │   │   /api/auth/*    ───────────────▶   auth-service:8081              │    │   │
│  │   │   /api/map/*     ───────────────▶   map-service:8082              │    │   │
│  │   │   /api/admin/*   ───────────────▶   map-service:8082              │    │   │
│  │   │   /             ───────────────▶   frontend:3000                  │    │   │
│  │   │                                                                     │    │   │
│  │   └─────────────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                           │
│                    ┌─────────────────────┴─────────────────────┐                   │
│                    │                                           │                   │
│                    ▼                                           ▼                   │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────────────┐  │
│  │     AUTHENTICATION SERVICE      │   │           MAP SERVICE                   │  │
│  │         (Go + Gin)              │   │          (Go + Gin)                     │  │
│  │        Port: 8081               │   │         Port: 8082                      │  │
│  │                                 │   │                                         │  │
│  │  ┌─────────────────────────┐    │   │  ┌─────────────────────────────────┐   │  │
│  │  │     Handler Layer      │    │   │  │        Handler Layer             │   │  │
│  │  │  - AuthHandler         │    │   │  │  - GeoObjectHandler              │   │  │
│  │  │  - OAuthHandler       │    │   │  │  - ComplaintHandler              │   │  │
│  │  └─────────────────────────┘    │   │  │  - HistoryHandler                │   │  │
│  │                                 │   │  └─────────────────────────────────┘   │  │
│  │  ┌─────────────────────────┐    │   │                                         │  │
│  │  │     Service Layer       │    │   │  ┌─────────────────────────────────┐   │  │
│  │  │  - AuthService         │    │   │  │        Service Layer              │   │  │
│  │  │  - OAuthService       │    │   │  │  - GeoObjectService              │   │  │
│  │  │  - EmailService       │    │   │  │  - ComplaintService              │   │  │
│  │  │  - VerificationService│    │   │  │  - VersionService                │   │  │
│  │  └─────────────────────────┘    │   │  └─────────────────────────────────┘   │  │
│  │                                 │   │                                         │  │
│  │  ┌─────────────────────────┐    │   │  ┌─────────────────────────────────┐   │  │
│  │  │    Repository Layer    │    │   │  │       Repository Layer           │   │  │
│  │  │  - UserRepository     │    │   │  │  - GeoObjectRepository           │   │  │
│  │  └─────────────────────────┘    │   │  │  - ComplaintRepository          │   │  │
│  │                                 │   │  │  - VersionRepository            │   │  │
│  │  ┌─────────────────────────┐    │   │  └─────────────────────────────────┘   │  │
│  │  │     Middleware Layer    │    │   │                                         │  │
│  │  │  - JWTAuthMiddleware   │    │   │  ┌─────────────────────────────────┐   │  │
│  │  │  - CORSMiddleware     │    │   │  │       Middleware Layer           │   │  │
│  │  └─────────────────────────┘    │   │  │  - JWTAuthMiddleware            │   │  │
│  └─────────────────────────────────┘   │  │  - CORSMiddleware                │   │  │
│                                        │  └─────────────────────────────────┘   │  │
│                                        └─────────────────────────────────────────┘  │
│                    │                                           │                   │
│                    └─────────────────────┬─────────────────────┘                   │
│                                          │                                           │
│                                          ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                              DATA LAYER                                       │   │
│  │                                                                               │   │
│  │  ┌─────────────────────────────┐  ┌────────────────────────────────────┐   │   │
│  │  │      PostgreSQL + PostGIS    │  │           Redis Cache               │   │   │
│  │  │         Port: 5432           │  │           Port: 6379                │   │   │
│  │  │                             │  │                                    │   │   │
│  │  │  - users                   │  │  - geo_objects cache              │   │   │
│  │  │  - geo_objects             │  │  - layer data cache               │   │   │
│  │  │  - complaints              │  │  - session cache                  │   │   │
│  │  │  - geo_object_versions     │  │                                    │   │   │
│  │  │  - geo_object_history      │  │                                    │   │   │
│  │  └─────────────────────────────┘  └────────────────────────────────────┘   │   │
│  │                                                                               │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Microservices Architecture

```
awesomeProject/
├── auth-service/                  # Authentication microservice (Go + Gin)
│   ├── cmd/
│   │   └── main.go               # Entry point
│   ├── internal/
│   │   ├── config/               # Configuration management
│   │   ├── dto/                  # Data Transfer Objects
│   │   ├── handler/              # HTTP handlers
│   │   │   └── auth_handler.go   # Authentication endpoints
│   │   ├── middleware/           # JWT, CORS middleware
│   │   ├── model/                # Domain models (User)
│   │   ├── repository/           # Database operations
│   │   └── service/              # Business logic
│   │       ├── auth_service.go   # Authentication logic
│   │       ├── oauth_service.go  # OAuth 2.0 handling
│   │       ├── email_service.go  # Email sending
│   │       └── verification_service.go
│   ├── Dockerfile
│   └── go.mod
│
├── map-service/                   # Map/Geo object microservice (Go + Gin)
│   ├── cmd/
│   │   └── main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── dto/
│   │   │   ├── complaint.go
│   │   │   ├── geo_object.go
│   │   │   ├── geo_object_history.go
│   │   │   └── stats.go
│   │   ├── handler/
│   │   │   ├── complaint_handler.go
│   │   │   ├── geo_object_handler.go
│   │   │   └── geo_object_history_handler.go
│   │   ├── middleware/
│   │   ├── model/
│   │   │   ├── complaint.go
│   │   │   ├── geo_object.go
│   │   │   ├── geo_object_history.go
│   │   │   └── geo_object_version.go
│   │   ├── repository/
│   │   │   ├── complaint_repository.go
│   │   │   ├── geo_object_history_repository.go
│   │   │   ├── geo_object_repository.go
│   │   │   ├── geo_object_version_repository.go
│   │   │   └── redis_cache.go
│   │   └── service/
│   │       ├── complaint_service.go
│   │       ├── geo_object_history_service.go
│   │       ├── geo_object_service.go
│   │       └── geo_object_version_service.go
│   ├── pkg/
│   │   └── geometry/             # PostGIS geometry utilities
│   ├── Dockerfile
│   └── go.mod
│
├── frontend/                      # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/            # Admin dashboard components
│   │   │   ├── Editor/           # Map editor components
│   │   │   ├── Landing/         # Landing page components
│   │   │   ├── Layout/           # Layout components
│   │   │   ├── Map/              # Map components
│   │   │   ├── Objects/          # Object-related components
│   │   │   ├── Settings/         # Settings page
│   │   │   ├── VersionHistory/   # Version history components
│   │   │   └── Viewer/           # Map viewer components
│   │   ├── context/              # React contexts (AuthContext)
│   │   ├── hooks/                # Custom hooks (useGeoman)
│   │   ├── services/             # API service layer
│   │   ├── store/                # State management (Zustand)
│   │   ├── types/                # TypeScript types
│   │   └── utils/                # Utility functions
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
│
├── database/
│   ├── schema.sql                # Database schema
│   └── migrations/               # Migration files
│       ├── 001_initial_schema.sql
│       ├── 002_geo_object_history.sql
│       ├── 002_add_versioning.sql
│       └── 003_user_profile_and_complaints.sql
│
├── nginx/                        # API Gateway config
│   └── nginx.conf
│
├── docker-compose.yml            # Docker orchestration
└── README.md
```

---

## Use Case Diagrams

### Main Use Case Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              USE CASE DIAGRAM                                        │
│                          Kazakhstan Interactive Map Platform                         │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────────────────┐
                                    │      <<actor>>       │
                                    │     Administrator    │
                                    └──────────┬───────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
        ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
        │  Manage Users     │    │  Manage Global    │    │  Review Complaints│
        │  - Create user   │    │  Objects          │    │  - View complaints│
        │  - Edit user    │    │  - Create global  │    │  - Resolve status │
        │  - Delete user   │    │  - Edit global    │    │  - Add admin notes│
        │  - Assign roles  │    │  - Delete global  │    │                    │
        └─────────┬─────────┘    └─────────┬─────────┘    └─────────┬─────────┘
                  │                        │                        │
                  └────────────────────────┼────────────────────────┘
                                           │
                                           ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │                     <<include>>                                 │
        │                    View Statistics                              │
        │                 (Admin Dashboard)                               │
        └─────────────────────────────────────────────────────────────────┘


                                    ┌──────────────────────┐
                                    │      <<actor>>       │
                                    │       Expert         │
                                    └──────────┬───────────┘
                                               │
        ┌──────────────────────────────────────┼──────────────────────────────────────┐
        │                                      │                                      │
        │                                      ▼                                      │
        │                    ┌───────────────────────────────┐                        │
        │                    │     Manage Geographic Objects  │                        │
        │                    │     (Editor Mode)              │                        │
        │                    └───────────────┬────────────────┘                        │
        │                                    │                                         │
        │           ┌────────────────────────┼────────────────────────┐               │
        │           │                        │                        │               │
        │           ▼                        ▼                        ▼               │
        │  ┌────────────────┐    ┌────────────────────┐    ┌────────────────┐        │
        │  │ Create Object  │    │   Edit Object     │    │ Delete Object  │        │
        │  │ - Draw shape  │    │  - Modify geometry│    │ - Remove from  │        │
        │  │ - Set type    │    │  - Update props   │    │   map          │        │
        │  │ - Set scope   │    │  - Change scope  │    │ - Delete from  │        │
        │  │ - Add metadata│    │                   │    │   database     │        │
        │  └────────────────┘    └────────────────────┘    └────────────────┘        │
        │                                                                              │
        └──────────────────────────────────────────────────────────────────────────────┘


                                    ┌──────────────────────┐
                                    │      <<actor>>       │
                                    │       User           │
                                    └──────────┬───────────┘
                                               │
        ┌──────────────────────────────────────┼──────────────────────────────────────┐
        │                                      │                                      │
        │                                      ▼                                      │
        │                    ┌───────────────────────────────┐                        │
        │                    │       Authenticate            │                        │
        │                    │  - Register                   │                        │
        │                    │  - Login                      │                        │
        │                    │  - OAuth Login               │                        │
        │                    │  - Logout                    │                        │
        │                    └───────────────┬────────────────┘                        │
        │                                    │                                         │
        │                                    ▼                                         │
        │                    ┌───────────────────────────────┐                        │
        │                    │     View Interactive Map       │                        │
        │                    │  (Viewer Mode)                  │                        │
        │                    └───────────────┬────────────────┘                        │
        │                                    │                                         │
        │           ┌────────────────────────┼────────────────────────┐               │
        │           │                        │                        │               │
        │           ▼                        ▼                        ▼               │
        │  ┌────────────────┐    ┌────────────────────┐    ┌────────────────┐        │
        │  │ Browse Objects │    │  Search Objects   │    │ Manage Layers  │        │
        │  │ - View details │    │  - By name        │    │ - Toggle types │        │
        │  │ - View history │    │  - Filter by type │    │ - Zoom levels  │        │
        │  └────────────────┘    └────────────────────┘    └────────────────┘        │
        │                                                                              │
        │           ┌────────────────────────┐                                       │
        │           │  Submit Complaint      │                                       │
        │           │  - Report content     │                                       │
        │           │  - Track status       │                                       │
        │           └────────────────────────┘                                       │
        │                                                                              │
        └──────────────────────────────────────────────────────────────────────────────┘
```

### Authentication Use Case Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION USE CASES                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │   Visitor   │         │  Registered │         │   System    │
    │             │         │    User     │         │             │
    └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
           │                       │                       │
           │ register              │                       │
           ▼                       │                       │
    ┌──────────────┐               │                       │
    │  Fill Form   │               │                       │
    └──────┬───────┘               │                       │
           │                       │                       │
           │ submit                │                       │
           ▼                       │                       │
    ┌──────────────┐               │                       │
    │Verify Email  │               │                       │
    │  (optional)  │               │                       │
    └──────┬───────┘               │                       │
           │                       │                       │
           │ activate              │                       │
           ▼                       │                       │
    ┌──────────────┐  login        │                       │
    │  <<include>> │◄──────────────┤                       │
    │  Create User │               │                       │
    └──────┬───────┘               │                       │
           │                       │                       │
           │───────────────────────┼───────────────────────┤
           │                       │                       │
           │            ┌───────────▼───────────┐          │
           │            │    <<extend>>         │          │
           │            │    OAuth Login        │          │
           │            │    (Google)           │          │
           │            └───────────┬───────────┘          │
           │                        │                      │
           │                        │ login                │
           │                        ▼                      │
           │            ┌──────────────────────────┐       │
           │            │  Authenticate with       │       │
           │            │  Google OAuth 2.0        │       │
           │            └───────────┬───────────────┘       │
           │                        │                       │
           │                        ▼                       │
           │            ┌──────────────────────────┐       │
           │            │   <<extend>>              │       │
           │            │   Create/Link Account    │       │
           │            └───────────┬───────────────┘       │
           │                        │                       │
           └────────────────────────┼───────────────────────┘
                                    │
                                    │ authenticated
                                    ▼
                            ┌───────────────┐
                            │   JWT Token   │
                            │   Generated   │
                            └───────────────┘
```

### Geographic Object Management Use Case Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                   GEOGRAPHIC OBJECT MANAGEMENT USE CASES                             │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐
│     <<actor>>               │
│   Authenticated User        │
└──────────────┬──────────────┘
               │
               │ view map
               ▼
┌─────────────────────────────┐
│   View Interactive Map     │
│   - Load base map           │
│   - Display layers          │
│   - Show coordinates        │
└──────────────┬──────────────┘
               │
      ┌────────┼────────┐
      │        │        │
      │        │ select │
      │        ▼        │
      │ ┌──────────────────┐
      │ │ View Object Details│
      │ │ - Name, type      │
      │ │ - Description     │
      │ │ - View history    │
      │ └────────┬─────────┘
      │          │
      │          │ report
      │          ▼
      │ ┌──────────────────┐
      │ │  Submit Complaint│
      │ └──────────────────┘
      │                    
      │                    
      │                    
      └────────┬───────────┘
               │
    ┌───────────▼───────────┐
    │  Check User Role     │
    └───────────┬───────────┘
                │
      ┌─────────┴─────────┐
      │                   │
      │ user              │ expert/admin
      ▼                   ▼
┌─────────────┐    ┌─────────────────────────────┐
│ View Only   │    │ Access Editor Mode          │
│ (Viewer)    │    └──────────────┬──────────────┘
└─────────────┘                   │
                                  │ create object
                                  ▼
                        ┌─────────────────────┐
                        │   Draw Object       │
                        │ - Point/Line/Polygon│
                        │ - Set properties    │
                        │ - Set scope         │
                        └──────────┬──────────┘
                                   │
                                   │ validate
                                   ▼
                        ┌─────────────────────┐
                        │   Save Object      │
                        │ - Create version   │
                        │ - Store in DB      │
                        │ - Update cache     │
                        └─────────────────────┘
```

---

## Sequence Diagrams

### User Registration Sequence

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         USER REGISTRATION SEQUENCE                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

actor       frontend                  nginx              auth-service           database
  │             │                       │                    │                    │
  │  1.Fill registration form          │                    │                    │
  │─────────────>│                       │                    │                    │
  │             │                        │                    │                    │
  │  2.Submit registration data         │                    │                    │
  │─────────────>│                       │                    │                    │
  │             │ 3.POST /api/auth/register              │                    │
  │             │───────────────────────>│                  │                    │
  │             │                        │                  │                    │
  │             │                        │ 4.Validate input │                    │
  │             │                        │─────────────────>│                    │
  │             │                        │                  │                    │
  │             │                        │ 5.Check if email exists               │
  │             │                        │────────────────────>│                 │
  │             │                        │                  │                    │
  │             │                        │ 6.Email not found │                    │
  │             │                        │<──────────────────│                    │
  │             │                        │                  │                    │
  │             │                        │ 7.Hash password  │                    │
  │             │                        │─────────────────>│                    │
  │             │                        │                  │                    │
  │             │                        │ 8.Insert user   │                    │
  │             │                        │────────────────────>│                 │
  │             │                        │                  │                    │
  │             │                        │ 9.User created   │                    │
  │             │                        │<──────────────────│                    │
  │             │                        │                  │                    │
  │             │                        │ 10.Generate JWT │                    │
  │             │                        │─────────────────>│                    │
  │             │                        │                  │                    │
  │             │ 11.Response with token │                  │                    │
  │             │<───────────────────────│                  │                    │
  │             │                        │                  │                    │
  │ 12.Success  │                        │                  │                    │
  │<────────────│                        │                  │                    │
  │             │                        │                  │                    │
```

### User Login Sequence

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              USER LOGIN SEQUENCE                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

actor       frontend                  nginx              auth-service           database
  │             │                       │                    │                    │
  │  1.Enter credentials               │                    │                    │
  │─────────────>│                       │                    │                    │
  │             │                        │                    │                    │
  │  2.Submit login                    │                    │                    │
  │─────────────>│                       │                    │                    │
  │             │ 3.POST /api/auth/login                   │                    │
  │             │───────────────────────>│                  │                    │
  │             │                        │                  │                    │
  │             │                        │ 4.Validate input │                    │
  │             │                        │─────────────────>│                    │
  │             │                        │                  │                    │
  │             │                        │ 5.Find user by email               │
  │             │                        │────────────────────>│               │
  │             │                        │                  │                    │
  │             │                        │ 6.Return user   │                    │
  │             │                        │<──────────────────│                  │
  │             │                        │                  │                    │
  │             │                        │ 7.Compare password                │
  │             │                        │─────────────────>│                  │
  │             │                        │                  │                    │
  │             │                        │ 8.Password valid                  │
  │             │                        │<──────────────────│                  │
  │             │                        │                  │                    │
  │             │                        │ 9.Generate JWT  │                    │
  │             │                        │─────────────────>│                  │
  │             │                        │                  │                    │
  │             │ 10.Response with token │                  │                    │
  │             │<───────────────────────│                  │                    │
  │             │                        │                  │                    │
  │ 11.Store token in localStorage     │                  │                    │
  │─────────────>│                       │                    │                    │
  │             │                        │                  │                    │
  │ 12.Redirect to map viewer          │                  │                    │
  │<────────────│                       │                    │                    │
  │             │                        │                  │                    │
```

### Create Geographic Object Sequence

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    CREATE GEOGRAPHIC OBJECT SEQUENCE                                 │
│                           (Expert/Admin Only)                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

actor         frontend                  nginx              map-service          database
  │               │                       │                    │                    │
  │  1.Draw object on map                 │                    │                    │
  │──────────────>│                       │                    │                    │
  │               │                        │                    │                    │
  │  2.Select object type                │                    │                    │
  │──────────────>│                       │                    │                    │
  │               │                        │                    │                    │
  │  3.Set properties                    │                    │                    │
  │  (name, description, scope)           │                    │                    │
  │──────────────>│                       │                    │                    │
  │               │                        │                    │                    │
  │  4.Click save                        │                    │                    │
  │──────────────>│                       │                    │                    │
  │               │ 5.POST /api/map/objects                   │                    │
  │               │ (with JWT token)      │                    │                    │
  │               │───────────────────────>│                  │                    │
  │               │                        │                  │                    │
  │               │                        │ 6.Validate JWT  │                    │
  │               │                        │─────────────────>│                    │
  │               │                        │                  │                    │
  │               │                        │ 7.Extract user  │                    │
  │               │                        │   from token    │                    │
  │               │                        │─────────────────>│                    │
  │               │                        │                  │                    │
  │               │                        │ 8.Check role    │                    │
  │               │                        │ (admin/expert)  │                    │
  │               │                        │─────────────────>│                    │
  │               │                        │                  │                    │
  │               │                        │ 9.Valid object  │                    │
  │               │                        │   data          │                    │
  │               │                        │─────────────────>│                    │
  │               │                        │                  │                    │
  │               │                        │ 10.Convert to   │                    │
  │               │                        │   PostGIS geom  │                    │
  │               │                        │─────────────────>│                    │
  │               │                        │                  │                    │
  │               │                        │ 11.Insert object│                   │
  │               │                        │────────────────────>│                │
  │               │                        │                  │                    │
  │               │                        │ 12.Object saved │                    │
  │               │                        │<──────────────────│                  │
  │               │                        │                  │                    │
  │               │                        │ 13.Create       │                    │
  │               │                        │   version 1     │                    │
  │               │                        │─────────────────>│                    │
  │               │                        │                  │                    │
  │               │                        │ 14.Invalidate   │                    │
  │               │                        │   Redis cache   │                    │
  │               │                        │─────────────────>│                    │
  │               │                        │                  │                    │
  │               │ 15.Response (201)     │                  │                    │
  │               │<───────────────────────│                  │                    │
  │               │                        │                  │                    │
  │  16.Render new object on map          │                  │                    │
  │<──────────────│                       │                    │                    │
  │               │                        │                  │                    │
```

### View Map with Layers Sequence

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              VIEW MAP SEQUENCE                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

actor         frontend                  nginx              map-service          database   redis
  │               │                       │                    │                    │      │
  │  1.Load map page                     │                    │                    │      │
  │──────────────>│                       │                    │                    │      │
  │               │                        │                    │                    │      │
  │  2.Initialize Leaflet map            │                    │                    │      │
  │──────────────>│                       │                    │                    │      │
  │               │                        │                    │                    │      │
  │  3.GET /api/map/objects             │                    │                    │      │
  │  (with JWT)  │                       │                    │                    │      │
  │──────────────>│───────────────────────>│                  │                    │      │
  │               │                        │                  │                    │      │
  │               │                        │ 4.Check JWT     │                    │      │
  │               │                        │─────────────────>│                    │      │
  │               │                        │                  │                    │      │
  │               │                        │ 5.Get cached    │                    │      │
  │               │                        │   objects       │                    │      │
  │               │                        │─────────────────────────────>│         │
  │               │                        │                  │                    │      │
  │               │                        │ 6.Cache hit?    │                    │      │
  │               │                        │<─────────────────────────────│         │
  │               │                        │                  │                    │      │
  │               │                        │ 7.Cache miss    │                    │      │
  │               │                        │─────────────────────────────>│         │
  │               │                        │                  │                    │      │
  │               │                        │ 8.Query objects │                    │      │
  │               │                        │   (global +     │                    │      │
  │               │                        │   owned private)│                    │      │
  │               │                        │────────────────────>│                 │      │
  │               │                        │                  │                    │      │
  │               │                        │ 9.Return data  │                    │      │
  │               │                        │<────────────────────│                 │      │
  │               │                        │                  │                    │      │
  │               │                        │ 10.Cache objects│                    │      │
  │               │                        │─────────────────────────────>│         │
  │               │                        │                  │                    │      │
  │               │ 11.Response with objects                │                    │      │
  │               │<───────────────────────│                  │                    │      │
  │               │                        │                  │                    │      │
  │  12.Render Kazakhstan boundary       │                  │                    │      │
  │──────────────>│                       │                    │                    │      │
  │               │                        │                  │                    │      │
  │  13.Render layer groups               │                  │                    │      │
  │  (by type)    │                       │                    │                    │      │
  │──────────────>│                       │                    │                    │      │
  │               │                        │                  │                    │      │
  │  14.Map fully loaded                  │                  │                    │      │
  │<──────────────│                       │                    │                    │      │
  │               │                        │                  │                    │      │
```

### Version History Sequence

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          VERSION HISTORY SEQUENCE                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

actor         frontend                  nginx              map-service          database
  │               │                       │                    │                    │
  │  1.Click on object                    │                    │                    │
  │──────────────>│                       │                    │                    │
  │               │                        │                    │                    │
  │  2.Show object details                │                    │                    │
  │  with history button                  │                    │                    │
  │──────────────>│                       │                    │                    │
  │               │                        │                    │                    │
  │  3.Click "View History"               │                    │                    │
  │──────────────>│                       │                    │                    │
  │               │                        │                    │                    │
  │  4.GET /api/map/objects/:id/versions  │                    │                    │
  │──────────────>│───────────────────────>│                  │                    │
  │               │                        │                  │                    │
  │               │                        │ 5.Validate JWT │                    │
  │               │                        │─────────────────>│                    │
  │               │                        │                  │                    │
  │               │                        │ 6.Get versions  │                    │
  │               │                        │   for object    │                    │
  │               │                        │────────────────────>│                │
  │               │                        │                  │                    │
  │               │                        │ 7.Return versions                   │
  │               │                        │<────────────────────│                │
  │               │                        │                  │                    │
  │               │ 8.Response with versions                │                    │
  │               │<───────────────────────│                  │                    │
  │               │                        │                  │                    │
  │  9.Show version history panel         │                  │                    │
  │<──────────────│                       │                    │                    │
  │               │                        │                  │                    │
  │  10.Select two versions to compare   │                  │                    │
  │──────────────>│                       │                    │                    │
  │               │                        │                  │                    │
  │  11.GET /api/map/objects/:id/compare  │                  │                    │
  │  ?v1=1&v2=2   │                       │                    │                    │
  │──────────────>│───────────────────────>│                  │                    │
  │               │                        │                  │                    │
  │               │                        │ 12.Get both versions              │
  │               │                        │   from DB     │                    │
  │               │                        │────────────────────>│             │
  │               │                        │                  │                    │
  │               │                        │ 13.Calculate diff│                   │
  │               │                        │   (geometry,    │                    │
  │               │                        │   properties)   │                    │
  │               │                        │─────────────────>│                    │
  │               │                        │                  │                    │
  │               │                        │ 14.Return comparison             │
  │               │                        │<────────────────────│                │
  │               │                        │                  │                    │
  │               │ 15.Response with diff │                  │                    │
  │               │<───────────────────────│                  │                    │
  │               │                        │                  │                    │
  │  16.Display comparison view           │                  │                    │
  │<──────────────│                       │                    │                    │
  │               │                        │                  │                    │
```

---

## Class Diagrams

### Backend Class Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND CLASS DIAGRAM                                    │
│                               Auth Service                                           │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              <<entity>>                                              │
│                                User                                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID                                                                         │
│ - email: string                                                                    │
│ - password_hash: string                                                            │
│ - role: string                                                                     │
│ - first_name: string                                                               │
│ - last_name: string                                                                 │
│ - nickname: string                                                                  │
│ - created_at: time.Time                                                            │
│ - updated_at: time.Time                                                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ + IsAdmin(): bool                                                                  │
│ + IsExpert(): bool                                                                  │
│ + CanEdit(): bool                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
           △
           │
           │ 1..*
           │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              <<entity>>                                              │
│                             GeoObject                                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID                                                                         │
│ - owner_id: *UUID                                                                  │
│ - parent_id: *UUID                                                                 │
│ - scope: string                                                                     │
│ - type: string                                                                      │
│ - name: string                                                                      │
│ - description: string                                                              │
│ - metadata: json.RawMessage                                                        │
│ - geometry: interface{}                                                            │
│ - is_version: bool                                                                 │
│ - version_number: int                                                              │
│ - created_at: time.Time                                                            │
│ - updated_at: time.Time                                                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ + ValidScopes(): []string                                                           │
│ + ValidTypes(): []string                                                            │
│ + IsValidScope(scope string): bool                                                 │
│ + IsValidType(objType string): bool                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
           △
           │
           │ 1..*
           │
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          <<entity>>                                                  │
│                      GeoObjectVersion                                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID                                                                         │
│ - object_id: UUID                                                                  │
│ - user_id: UUID                                                                    │
│ - version_number: int                                                              │
│ - change_description: string                                                       │
│ - geometry_changed: bool                                                           │
│ - name_changed: bool                                                                │
│ - description_changed: bool                                                        │
│ - type_changed: bool                                                               │
│ - scope_changed: bool                                                             │
│ - metadata_changed: bool                                                           │
│ - geometry: []byte                                                                  │
│ - created_at: time.Time                                                            │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              <<entity>>                                              │
│                              Complaint                                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID                                                                         │
│ - user_id: UUID                                                                    │
│ - object_id: *UUID                                                                 │
│ - object_type: string                                                              │
│ - description: string                                                              │
│ - status: string                                                                   │
│ - admin_notes: string                                                              │
│ - created_at: time.Time                                                            │
│ - updated_at: time.Time                                                            │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER CLASSES                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐     ┌─────────────────────────────┐
│   <<service>>               │     │   <<service>>               │
│   AuthService               │     │   GeoObjectService          │
├─────────────────────────────┤     ├─────────────────────────────┤
│ - userRepo: UserRepository   │     │ - repo: GeoObjectRepo       │
│ - jwtSecret: string         │     │ - versionRepo: VersionRepo  │
│ - jwtExpiry: time.Duration  │     │ - cache: RedisCache         │
├─────────────────────────────┤     ├─────────────────────────────┤
│ + Register(req): (*User,   │     │ + Create(obj): (*GeoObject,│
│   error)                    │     │   error)                    │
│ + Login(email, pass):       │     │ + GetByID(id): (*GeoObject, │
│   (*User, string, error)   │     │   error)                    │
│ + ValidateToken(token):    │     │ + Update(id, req):          │
│   (*User, error)           │     │   (*GeoObject, error)       │
│ + RefreshToken(token):     │     │ + Delete(id): error          │
│   (string, error)          │     │ + List(filter): ([]GeoObject│
│ + GetUser(id): (*User,     │     │   , total, error)           │
│   error)                   │     │ + GetVersions(id):          │
│ + UpdateUser(id, req):     │     │   ([]Version, error)        │
│   (*User, error)           │     │ + CompareVersions(v1, v2):  │
│ + DeleteUser(id): error   │     │   (*CompareResult, error)   │
└─────────────────────────────┘     └─────────────────────────────┘
           │                                   │
           │                                   │
           │ uses                              │ uses
           ▼                                   ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   <<repository>>            │     │   <<repository>>            │
│   UserRepository            │     │   GeoObjectRepository       │
├─────────────────────────────┤     ├─────────────────────────────┤
│ - db: *sql.DB              │     │ - db: *sql.DB              │
├─────────────────────────────┤     ├─────────────────────────────┤
│ + Create(user): (*User,     │     │ + Create(obj): (*GeoObject,│
│   error)                   │     │   error)                    │
│ + FindByEmail(email):       │     │ + FindByID(id): (*GeoObject│
│   (*User, error)           │     │   , error)                  │
│ + FindByID(id): (*User,    │     │ + Update(obj): (*GeoObject, │
│   error)                   │     │   error)                    │
│ + Update(user): (*User,    │     │ + Delete(id): error         │
│   error)                   │     │ + FindAccessible(userID,    │
│ + Delete(id): error       │     │   scope, type): ([]GeoObj)  │
│ + List(filter): ([]User,   │     │ + FindByType(t): ([]GeoObj)│
│   total, error)           │     │ + Search(query): ([]GeoObj) │
└─────────────────────────────┘     └─────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         MIDDLEWARE CLASSES                                           │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐
│   <<middleware>>           │
│   JWTAuthMiddleware         │
├─────────────────────────────┤
│ - secret: string           │
├─────────────────────────────┤
│ + Handler() gin.HandlerFunc│
│ + ExtractUserID()           │
│ + ExtractUserRole()        │
└─────────────────────────────┘
```

### Frontend Class/Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND COMPONENT HIERARCHY                                │
└─────────────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────────────────────────────┐
                           │           App (Root)                 │
                           │         (React Component)           │
                           └──────────────────┬──────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐ ┌──────────────────────────┐
│        AuthProvider             │ │       BrowserRouter             │ │    ErrorBoundary         │
│    (Context Provider)          │ │     (React Router)              │ │  (Error Handling)         │
└─────────────────────────────────┘ └─────────────────────────────────┘ └──────────────────────────┘
         │
         │ uses
         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            AuthContext                                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ - user: User | null                                                                  │
│ - token: string | null                                                              │
│ - isAuthenticated: boolean                                                          │
│ - isAdmin: boolean                                                                  │
│ - isExpert: boolean                                                                 │
│ - canEdit: boolean                                                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ + login(email, password): Promise<void>                                             │
│ + register(email, password, role): Promise<void>                                   │
│ + logout(): void                                                                     │
│ + updateProfile(data): Promise<void>                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                      │
                                      │ routes
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              ROUTES                                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   /                     →  LandingPage                                              │
│   /login                →  LoginPage                                                │
│   /register             →  RegisterPage                                             │
│   /map                  →  MapViewer (protected)                                     │
│   /editor               →  MapEditor (admin/expert only)                            │
│   /admin                →  AdminRoutes (admin only)                                │
│       /dashboard        →  DashboardPage                                            │
│       /users            →  UsersPage                                                 │
│       /complaints       →  ComplaintsPage                                           │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────────────────────────────┐
                           │         MapViewer / MapEditor       │
                           │        (Main Map Component)         │
                           └──────────────────┬──────────────────┘
                                              │
        ┌─────────────────────────────────────┼─────────────────────────────────────┐
        │                                     │                                     │
        ▼                                     ▼                                     ▼
┌───────────────────┐              ┌─────────────────────┐               ┌─────────────────────┐
│  MapView.tsx      │              │   Toolbar.tsx      │               │ LayersPanel.tsx    │
│  (Leaflet Map)    │              │ (Drawing Tools)    │               │ (Layer Toggle)      │
└───────────────────┘              └─────────────────────┘               └─────────────────────┘
        │
        │ uses
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            Map State (Zustand Store)                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   editorStore:                                                                      │
│   - selectedObject: GeoObject | null                                                │
│   - drawingMode: DrawingMode | null                                                 │
│   - history: GeoObjectHistory[]                                                    │
│   - setSelectedObject(obj): void                                                    │
│   - setDrawingMode(mode): void                                                      │
│                                                                                      │
│   viewerStore:                                                                      │
│   - layerVisibility: LayerVisibility                                                │
│   - selectedFeature: GeoObject | null                                               │
│   - searchResults: GeoObject[]                                                      │
│   - toggleLayer(type): void                                                         │
│   - setSelectedFeature(obj): void                                                   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

        │ uses
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            Service Layer                                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   api.ts (Axios instance):                                                          │
│   - baseURL: VITE_API_URL                                                            │
│   - interceptors for JWT                                                             │
│                                                                                      │
│   GeoObjectService:                                                                 │
│   - getAll(): Promise<GeoObjectListResponse>                                         │
│   - getById(id): Promise<GeoObject>                                                 │
│   - create(data): Promise<GeoObject>                                                │
│   - update(id, data): Promise<GeoObject>                                            │
│   - delete(id): Promise<void>                                                        │
│   - getVersions(id): Promise<VersionListResponse>                                   │
│   - compareVersions(id, v1, v2): Promise<VersionCompareResult>                      │
│                                                                                      │
│   AuthService:                                                                      │
│   - login(data): Promise<AuthResponse>                                               │
│   - register(data): Promise<AuthResponse>                                            │
│   - logout(): void                                                                   │
│   - getProfile(): Promise<User>                                                      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        COMPONENT ARCHITECTURE DIAGRAM                                │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              EXTERNAL COMPONENTS
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │   Google   │  │    SMTP     │  │  Browser    │  │   Leaflet   │
    │   OAuth    │  │   Server    │  │   Client    │  │     JS      │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │                │
           └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND COMPONENTS                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │   Landing   │  │   Viewer    │  │   Editor    │  │   Admin     │                │
│  │  Component  │  │  Component  │  │  Component  │  │  Component  │                │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │   Layout    │  │    Map      │  │  Properties │  │   Version   │                │
│  │  Component  │  │   Layer     │  │   Panel     │  │  History    │                │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐              │
│  │                      React Context & State                          │              │
│  │   AuthContext  │  EditorStore  │  ViewerStore  │  AdminStore      │              │
│  └─────────────────────────────────────────────────────────────────────┘              │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐              │
│  │                      Service Layer                                  │              │
│  │   api.ts  │  GeoObjectService.ts  │  AuthService.ts              │              │
│  └─────────────────────────────────────────────────────────────────────┘              │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND SERVICES                                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐     │
│  │                         AUTHENTICATION SERVICE                               │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │     │
│  │  │   Handler   │  │   Service   │  │ Repository  │  │  Middleware │      │     │
│  │  │ AuthHandler │  │ AuthService │  │UserRepository│ │JWTAuth     │      │     │
│  │  │OAuthHandler │  │OAuthService │  │             │  │CORS        │      │     │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │     │
│  └─────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐     │
│  │                            MAP SERVICE                                       │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │     │
│  │  │   Handler   │  │   Service   │  │ Repository  │  │  Middleware │      │     │
│  │  │GeoObjHandler│  │GeoObjService│  │GeoObjRepo   │  │JWTAuth     │      │     │
│  │  │ComplaintHdlr│  │ComplaintSvc │  │ComplaintRepo│  │CORS        │      │     │
│  │  │HistoryHandler│  │VersionSvc   │  │VersionRepo  │  │            │      │     │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │     │
│  │                                                                         │     │
│  │  ┌─────────────────────────────────────────────────────────────────┐     │     │
│  │  │                      Package: geometry                          │     │     │
│  │  │                 PostGIS geometry utilities                     │     │     │
│  │  └─────────────────────────────────────────────────────────────────┘     │     │
│  └─────────────────────────────────────────────────────────────────────────────┘     │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SQL/Redis
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐            │
│  │      PostgreSQL + PostGIS       │  │         Redis Cache             │            │
│  │                                 │  │                                 │            │
│  │  Tables:                        │  │  Cached Data:                  │            │
│  │  - users                       │  │  - geo_objects (by scope)     │            │
│  │  - geo_objects                 │  │  - layer data                 │            │
│  │  - geo_object_versions         │  │  - search results             │            │
│  │  - geo_object_history          │  │                                 │            │
│  │  - complaints                 │  │                                 │            │
│  │                                 │  │                                 │            │
│  │  Extensions:                   │  │                                 │            │
│  │  - uuid-ossp                   │  │                                 │            │
│  │  - postgis                     │  │                                 │            │
│  └─────────────────────────────────┘  └─────────────────────────────────┘            │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        COMPONENT INTERACTION FLOW                                     │
│                         Map Viewer Components                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

User Action: View Map
─────────────────────

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  App     │    │ MapViewer│    │ MapView  │    │  API     │    │ Backend  │
│  Router  │    │  Component│   │(Leaflet) │   │ Service  │    │  Server  │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │              │              │              │              │
     │ /map route  │              │              │              │
     │────────────>│              │              │              │
     │              │              │              │              │
     │              │ mount        │              │              │
     │              │─────────────>│              │              │
     │              │              │              │              │
     │              │              │ fetchObjects │              │
     │              │              │─────────────>│              │
     │              │              │              │              │
     │              │              │              │ GET /api/map │
     │              │              │              │ objects      │
     │              │              │              │─────────────>│
     │              │              │              │              │
     │              │              │              │  JSON data  │
     │              │              │              │<─────────────│
     │              │              │              │              │
     │              │              │  GeoJSON    │              │
     │              │              │<─────────────│              │
     │              │              │              │              │
     │              │              │ addTo map   │              │
     │              │              │─────────────>│              │
     │              │              │              │              │
     │              │  rendered    │              │              │
     │              │<─────────────│              │              │
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼


User Action: Toggle Layer
──────────────────────────

┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────────┐
│  User    │    │LayersPanel  │    │ MapView  │    │ ViewerStore  │
└────┬─────┘    └──────┬──────┘    └────┬─────┘    └──────┬───────┘
     │                 │               │                │
     │ click toggle    │               │                │
     │────────────────>│               │                │
     │                 │               │                │
     │                 │ toggleLayer() │                │
     │                 │──────────────>│                │
     │                 │               │                │
     │                 │               │ setVisibility  │
     │                 │               │────────────────>│
     │                 │               │                │
     │                 │               │  show/hide     │
     │                 │               │  layer group   │
     │                 │               │<────────────────│
     │                 │               │                │
     ▼                 ▼               ▼                ▼


User Action: Edit Object (Expert/Admin)
────────────────────────────────────────

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │ MapEditor│    │ Geoman   │    │ Editor   │    │  API     │
│          │    │ Component│    │ Controller│   │ Store    │    │ Service  │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │              │              │              │
     │ draw/edit     │              │              │              │
     │──────────────>│              │              │              │
     │               │              │              │              │
     │               │  onDrawCreated             │              │
     │               │  or onEdit                  │              │
     │               │─────────────>│              │              │
     │               │              │              │              │
     │               │              │ updateFeature│              │
     │               │              │─────────────>│              │
     │               │              │              │              │
     │               │              │              │ setDrawing   │
     │               │              │              │─────────────>│
     │               │              │              │              │
     │               │              │              │ validate     │
     │               │              │              │<─────────────│
     │               │              │              │              │
     │               │              │  save        │              │
     │               │              │─────────────>│              │
     │               │              │              │              │
     │               │              │              │ PUT /api/map │
     │               │              │              │ objects/:id  │
     │               │              │              │─────────────>│
     │               │              │              │              │
     │               │              │              │   success    │
     │               │              │              │<─────────────│
     │               │              │              │              │
     │               │              │ updateObject │              │
     │               │              │<─────────────│              │
     │               │              │              │              │
     │               │  updated     │              │              │
     │               │<─────────────│              │              │
     │               │              │              │              │
     ▼               ▼              ▼              ▼              ▼
```

---

## Database Design

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE ENTITY RELATIONSHIP                                │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────┐         ┌────────────────────────┐
│        users          │         │      geo_objects        │
├────────────────────────┤         ├────────────────────────┤
│ id (PK) UUID          │         │ id (PK) UUID           │
│ email (UNIQUE)        │         │ owner_id (FK) UUID     │
│ password_hash         │    1─── *│ scope VARCHAR(20)      │
│ role VARCHAR(50)       │         │ type VARCHAR(50)       │
│ first_name            │         │ name VARCHAR(255)      │
│ last_name             │         │ description TEXT       │
│ nickname              │         │ metadata JSONB          │
│ created_at            │         │ geometry GEOMETRY       │
│ updated_at            │         │ created_at              │
└────────────────────────┘         │ updated_at              │
                                   └───────────┬──────────────┘
                                               │
                                               │ 1..*
                                               │
                                   ┌───────────▼───────────────┐
                                   │   geo_object_versions    │
                                   ├──────────────────────────┤
                                   │ id (PK) UUID             │
                                   │ object_id (FK) UUID  ────┼──► geo_objects
                                   │ user_id (FK) UUID    ────┼──► users
                                   │ version_number INT       │
                                   │ change_description TEXT  │
                                   │ geometry_changed BOOL    │
                                   │ name_changed BOOL        │
                                   │ description_changed BOOL│
                                   │ type_changed BOOL        │
                                   │ scope_changed BOOL       │
                                   │ metadata_changed BOOL    │
                                   │ geometry BYTEA            │
                                   │ created_at               │
                                   └──────────────────────────┘

┌────────────────────────┐         ┌────────────────────────┐
│       complaints        │         │    geo_object_history   │
├────────────────────────┤         ├────────────────────────┤
│ id (PK) UUID           │         │ id (PK) UUID            │
│ user_id (FK) UUID  ────┼──► users │ object_id (FK) UUID ───┼──► geo_objects
│ object_id (FK) UUID ───┼──► geo_  │ user_id (FK) UUID  ────┼──► users
│           objects      │         │ action VARCHAR(20)      │
│ object_type VARCHAR(50)│         │ description TEXT        │
│ description TEXT       │         │ before_snapshot JSONB   │
│ status VARCHAR(20)      │         │ after_snapshot JSONB   │
│ admin_notes TEXT       │         │ created_at              │
│ created_at             │         └────────────────────────┘
│ updated_at             │
└────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA TABLES                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

Users Table:
────────────
┌─────────────────────────┬──────────────────┬─────────────┬────────────────────────┐
│        Column           │      Type        │  Constraint │       Description      │
├─────────────────────────┼──────────────────┼─────────────┼────────────────────────┤
│ id                      │ UUID             │ PK          │ Unique user ID         │
│ email                   │ VARCHAR(255)     │ UNIQUE, NOT NULL            │
│ password_hash           │ VARCHAR(255)     │ NOT NULL    │ Bcrypt hashed password│
│ role                    │ VARCHAR(50)      │ NOT NULL, DEFAULT 'user'    │
│ first_name              │ VARCHAR(100)     │ DEFAULT ''  │ User first name        │
│ last_name               │ VARCHAR(100)     │ DEFAULT ''  │ User last name         │
│ nickname                │ VARCHAR(100)     │ DEFAULT ''  │ User nickname          │
│ created_at              │ TIMESTAMP        │ DEFAULT NOW │ Account creation time │
│ updated_at              │ TIMESTAMP        │ DEFAULT NOW │ Last update time       │
└─────────────────────────┴──────────────────┴─────────────┴────────────────────────┘

Geo Objects Table:
──────────────────
┌─────────────────────────┬──────────────────┬─────────────┬────────────────────────┐
│        Column           │      Type        │  Constraint │       Description      │
├─────────────────────────┼──────────────────┼─────────────┼────────────────────────┤
│ id                      │ UUID             │ PK          │ Unique object ID      │
│ owner_id                │ UUID             │ FK → users  │ Object owner          │
│ scope                   │ VARCHAR(20)      │ NOT NULL, CHECK IN (global, private)│
│ type                    │ VARCHAR(50)      │ NOT NULL    │ Object type           │
│ name                    │ VARCHAR(255)     │ NOT NULL    │ Object name           │
│ description             │ TEXT             │             │ Object description    │
│ metadata                │ JSONB            │ DEFAULT '{}'│ Additional metadata   │
│ geometry                │ GEOMETRY         │ NOT NULL    │ PostGIS geometry      │
│ created_at              │ TIMESTAMP        │ DEFAULT NOW │ Creation time        │
│ updated_at              │ TIMESTAMP        │ DEFAULT NOW │ Last update time     │
└─────────────────────────┴──────────────────┴─────────────┴────────────────────────┘

Indexes:
- idx_geo_objects_geometry (GIST) - Spatial queries
- idx_geo_objects_metadata (GIN) - JSONB queries
- idx_geo_objects_scope - Scope filtering
- idx_geo_objects_owner - Owner filtering
- idx_geo_objects_type - Type filtering
- idx_geo_objects_scope_owner_type - Composite for queries
```

---

## Security Requirements

### JWT Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         JWT AUTHENTICATION FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
    │ Client │    │Frontend│    │ Nginx  │    │ Service│    │  JWT   │
    │        │    │       │    │ Gateway│    │        │    │Validator│
    └────┬───┘    └────┬───┘    └───┬────┘    └───┬────┘    └───┬────┘
         │              │            │            │            │
         │ 1.Login request           │            │            │
         │────────────>│            │            │            │
         │             │ 2.POST /api/auth/login  │            │
         │             │───────────────────────>│            │
         │             │            │            │            │
         │             │            │ 3.Authenticate user     │
         │             │            │────────────────────────>│
         │             │            │            │            │
         │             │            │ 4.Generate JWT           │
         │             │            │<────────────────────────│
         │             │            │            │            │
         │ 5.Response with JWT      │            │            │
         │<──────────────────────────│            │            │
         │             │            │            │            │
         │ 6.Store JWT in localStorage            │            │
         │────────────>│            │            │            │
         │             │            │            │            │
         │ 7.Request with JWT       │            │            │
         │ (Authorization: Bearer)   │            │            │
         │────────────>│────────────>│            │            │
         │             │            │ 8.Forward request       │
         │             │            │────────────────────────>│
         │             │            │            │            │
         │             │            │ 9.Extract & validate JWT│
         │             │            │<─────────────────────────│
         │             │            │            │            │
         │             │            │ 10.Valid/Invalid         │
         │             │            │<─────────────────────────│
         │             │            │            │            │
         │             │            │ 11.Forward response     │
         │             │<──────────────────────────│            │
         │ 12.Response│            │            │            │
         │<────────────│            │            │            │
         │             │            │            │            │
```

### Role-Based Access Control (RBAC)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         ROLE-BASED ACCESS CONTROL                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    ROLES                                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐               │
│   │     Admin       │     │     Expert      │     │      User       │               │
│   ├─────────────────┤     ├─────────────────┤     ├─────────────────┤               │
│   │ - Full access  │     │ - View map      │     │ - View map      │               │
│   │ - Manage users │     │ - Edit objects  │     │ - Search objects│               │
│   │ - Manage global│     │ - Create objects│     │ - Toggle layers │               │
│   │   objects      │     │ - Delete own    │     │ - View details  │               │
│   │ - View stats   │     │   objects       │     │ - Submitcompl.  │               │
│   │ - Review comp. │     │ - View history  │     │ - View history │               │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘               │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                PERMISSION MATRIX                                      │
├────────────────────────────────────────────────────┬────────┬─────────┬──────────┤
│                     Operation                        │ Admin  │ Expert  │  User    │
├────────────────────────────────────────────────────┼────────┼─────────┼──────────┤
│ VIEW_MAP                                               │   ✓   │    ✓   │    ✓    │
│ SEARCH_OBJECTS                                         │   ✓   │    ✓   │    ✓    │
│ TOGGLE_LAYERS                                          │   ✓   │    ✓   │    ✓    │
│ VIEW_OBJECT_DETAILS                                    │   ✓   │    ✓   │    ✓    │
│ VIEW_VERSION_HISTORY                                   │   ✓   │    ✓   │    ✓    │
│ CREATE_PRIVATE_OBJECT                                 │   ✓   │    ✓   │    ✓    │
│ EDIT_PRIVATE_OBJECT                                    │   ✓   │    ✓   │    ✓    │
│ DELETE_PRIVATE_OBJECT                                  │   ✓   │    ✓   │    ✓    │
│ CREATE_GLOBAL_OBJECT                                   │   ✓   │    ✓   │    ✗    │
│ EDIT_GLOBAL_OBJECT                                     │   ✓   │    ✓   │    ✗    │
│ DELETE_GLOBAL_OBJECT                                   │   ✓   │    ✗   │    ✗    │
│ MANAGE_USERS                                           │   ✓   │    ✗   │    ✗    │
│ VIEW_STATISTICS                                        │   ✓   │    ✗   │    ✗    │
│ REVIEW_COMPLAINTS                                      │   ✓   │    ✗   │    ✗    │
└────────────────────────────────────────────────────────┴────────┴─────────┴──────────┘

Scope Validation:
─────────────────

Global Objects:
  - Visible to: ALL users (authenticated and anonymous)
  - Editable by: Admin only
  - Query: scope = 'global'

Private Objects:
  - Visible to: Owner only
  - Editable by: Owner only
  - Query: scope = 'private' AND owner_id = current_user_id
```

---

## API Endpoints

### Auth Service (Port 8081)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              AUTH SERVICE API                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  POST   /api/auth/register      - Register new user                                 │
│  POST   /api/auth/login         - Login user                                        │
│  POST   /api/auth/refresh       - Refresh token                                     │
│  POST   /api/auth/logout        - Logout user                                       │
│  GET    /api/auth/me            - Get current user (protected)                    │
│  PUT    /api/auth/profile       - Update profile (protected)                       │
│  PUT    /api/auth/password      - Change password (protected)                      │
│                                                                                      │
│  GET    /api/auth/oauth/google  - Google OAuth initiation                           │
│  GET    /api/auth/oauth/callback- Google OAuth callback                             │
│                                                                                      │
│  GET    /health                 - Health check                                      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Map Service (Port 8082)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              MAP SERVICE API                                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ─── Geo Objects ───                                                               │
│  GET    /api/map/objects           - Get all accessible objects (protected)         │
│  GET    /api/map/objects/:id       - Get object by ID (protected)                   │
│  POST   /api/map/objects           - Create new object (protected, expert/admin)   │
│  PUT    /api/map/objects/:id       - Update object (protected)                     │
│  DELETE /api/map/objects/:id       - Delete object (protected)                     │
│  GET    /api/map/objects/:id/versions    - Get version history (protected)         │
│  GET    /api/map/objects/:id/compare    - Compare versions (protected)             │
│                                                                                      │
│  ─── Search ───                                                                    │
│  GET    /api/map/search            - Search objects by name (protected)            │
│                                                                                      │
│  ─── Statistics ───                                                               │
│  GET    /api/map/stats             - Get object statistics (protected)             │
│                                                                                      │
│  ─── Complaints ───                                                               │
│  POST   /api/map/complaints        - Submit complaint (protected)                  │
│  GET    /api/map/complaints        - List complaints (protected, admin)            │
│  GET    /api/map/complaints/:id    - Get complaint (protected, admin)              │
│  PUT    /api/map/complaints/:id    - Update complaint (protected, admin)           │
│                                                                                      │
│  ─── Admin ───                                                                    │
│  GET    /api/admin/users           - List users (protected, admin)                 │
│  POST   /api/admin/users           - Create user (protected, admin)                │
│  GET    /api/admin/users/:id       - Get user (protected, admin)                   │
│  PUT    /api/admin/users/:id       - Update user (protected, admin)                │
│  DELETE /api/admin/users/:id       - Delete user (protected, admin)                │
│                                                                                      │
│  GET    /health                    - Health check                                   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

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

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8080 |
| Auth Service | http://localhost:8081 |
| Map Service | http://localhost:8082 |
| PostgreSQL | localhost:5433 |

### Default Admin Credentials

- Email: admin@kzmap.edu
- Password: admin123

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
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email
SMTP_PASSWORD=your-password

# Map Service
PORT=8082
DB_HOST=postgres
DB_PORT=5432
DB_NAME=kzmap
DB_USER=kzmap_user
DB_PASSWORD=kzmap_password
REDIS_URL=redis:6379
JWT_SECRET=your-secret-key

# Frontend
VITE_API_URL=http://localhost:8080
VITE_AUTH_SERVICE_URL=http://localhost:8081
VITE_MAP_SERVICE_URL=http://localhost:8082
```

---

## Technologies Used

### Backend
- **Go 1.21**: Modern Go with native HTTP server
- **Gin**: High-performance HTTP web framework
- **PostgreSQL + PostGIS**: Spatial database
- **Redis**: In-memory caching
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
- **Zustand**: State management

### Infrastructure
- **Docker**: Containerization
- **Nginx**: API Gateway and reverse proxy
- **PostGIS**: Geospatial extensions for PostgreSQL
