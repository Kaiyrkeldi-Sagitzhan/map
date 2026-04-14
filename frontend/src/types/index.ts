// User types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'expert' | 'user';
  first_name: string;
  last_name: string;
  nickname: string;
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
  first_name?: string;
  last_name?: string;
  nickname?: string;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  nickname?: string;
  current_password?: string;
  new_password?: string;
}

// Admin user management types
export interface AdminCreateUserRequest {
  email: string;
  password: string;
  role: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
}

export interface AdminUpdateUserRequest {
  email?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  password?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
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
  | 'city'
  | 'road'
  | 'boundary'
  | 'forest'
  | 'building'
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
  city: boolean;
  road: boolean;
  boundary: boolean;
  forest: boolean;
  building: boolean;
  other: boolean;
}

// History types
export interface GeoObjectHistory {
  id: string;
  objectId: string;
  userId: string;
  action: 'create' | 'update' | 'delete';
  description: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  createdAt: string;
}

// Complaint types
export interface Complaint {
  id: string;
  user_id: string;
  user_email: string;
  object_id?: string;
  object_type: string;
  object_name?: string;
  description: string;
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateComplaintRequest {
  object_id?: string;
  object_type: string;
  description: string;
}

export interface UpdateComplaintRequest {
  status?: string;
  admin_notes?: string;
}

export interface ComplaintListResponse {
  complaints: Complaint[];
  total: number;
  page: number;
  limit: number;
}

// Stats types
export interface TypeStat {
  type: string;
  count: number;
  centroid?: [number, number];
}

export interface StatsResponse {
  stats: TypeStat[];
  total: number;
}

// Version history types
export interface VersionInfo {
  id: string;
  version_number: number;
  object_id: string;
  user_id: string;
  change_description?: string;
  changes: {
    geometry: boolean;
    name: boolean;
    description: boolean;
    type: boolean;
    scope: boolean;
    metadata: boolean;
  };
  created_at: string;
}

export interface VersionListResponse {
  versions: VersionInfo[];
  total: number;
  current_version: number;
}

export interface VersionCompareResult {
  version1: GeoObject | null;
  version2: GeoObject | null;
  diff: {
    geometry_changed: boolean;
    name_changed: boolean;
    description_changed: boolean;
    type_changed: boolean;
    scope_changed: boolean;
    metadata_changed: boolean;
    geometry_diff?: {
      old_coords_count: number;
      new_coords_count: number;
    };
  };
}

// Auth context types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isExpert: boolean;
  canEdit: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  updateUser: (user: User) => void;
  setAuthData: (token: string, user: User) => void;
}
