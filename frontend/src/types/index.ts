// User types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role?: string;
}

// Geo object types
export interface GeoObject {
  id: string;
  owner_id?: string;
  scope: 'global' | 'private';
  type: ObjectType;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  geometry: GeoJSON.GeoJSON;
  created_at: string;
  updated_at: string;
}

export type ObjectType = 
  | 'river' 
  | 'lake' 
  | 'mountain' 
  | 'region' 
  | 'city' 
  | 'road' 
  | 'boundary' 
  | 'administrative'
  | 'other';

export interface GeoObjectListResponse {
  objects: GeoObject[];
  total: number;
}

export interface CreateGeoObjectRequest {
  scope: 'global' | 'private';
  type: ObjectType;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  geometry: GeoJSON.GeoJSON;
}

export interface UpdateGeoObjectRequest {
  scope?: 'global' | 'private';
  type?: ObjectType;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  geometry?: GeoJSON.GeoJSON;
}

// Map layer types
export interface LayerVisibility {
  river: boolean;
  lake: boolean;
  mountain: boolean;
  region: boolean;
  city: boolean;
  road: boolean;
  boundary: boolean;
  administrative: boolean;
  other: boolean;
}

// Auth context types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
}
