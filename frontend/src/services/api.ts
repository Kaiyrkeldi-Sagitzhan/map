import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  GeoObject,
  GeoObjectListResponse,
  CreateGeoObjectRequest,
  UpdateGeoObjectRequest,
  UpdateProfileRequest,
  User,
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  UserListResponse,
  StatsResponse,
  Complaint,
  CreateComplaintRequest,
  UpdateComplaintRequest,
  ComplaintListResponse,
} from '../types';

const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || '';
const MAP_SERVICE_URL = import.meta.env.VITE_MAP_SERVICE_URL || '';

class ApiService {
  private authClient: AxiosInstance;
  private mapClient: AxiosInstance;

  constructor() {
    this.authClient = axios.create({
      baseURL: AUTH_SERVICE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.mapClient = axios.create({
      baseURL: MAP_SERVICE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor to BOTH clients
    const addAuthHeader = (config: any) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    };

    this.authClient.interceptors.request.use(addAuthHeader);
    this.mapClient.interceptors.request.use(addAuthHeader);

    // Add response interceptor for error handling
    const handleAuthError = (error: AxiosError) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
      return Promise.reject(error);
    };

    this.authClient.interceptors.response.use((r) => r, handleAuthError);
    this.mapClient.interceptors.response.use((r) => r, handleAuthError);
  }

  // ========== Auth methods ==========

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.authClient.post<AuthResponse>('/api/auth/login', data);
    return response.data;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.authClient.post<AuthResponse>('/api/auth/register', data);
    return response.data;
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    const response = await this.authClient.post<AuthResponse>('/api/auth/refresh', { token });
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.authClient.get<User>('/api/auth/me');
    return response.data;
  }

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    const response = await this.authClient.put<User>('/api/auth/me', data);
    return response.data;
  }

  // ========== Email verification ==========

  async sendVerificationCode(email: string): Promise<void> {
    await this.authClient.post('/api/auth/verify/send', { email });
  }

  async verifyCode(email: string, code: string): Promise<void> {
    await this.authClient.post('/api/auth/verify', { email, code });
  }

  // ========== Google OAuth ==========

  async getGoogleAuthURL(redirectUri?: string): Promise<{ url: string }> {
    const response = await this.authClient.get<{ url: string }>('/api/auth/google/url', {
      params: redirectUri ? { redirect_uri: redirectUri } : undefined,
    });
    return response.data;
  }

  async handleGoogleCallback(code: string, redirectUri?: string): Promise<AuthResponse> {
    const response = await this.authClient.get<AuthResponse>('/api/auth/google/callback', {
      params: {
        code,
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      }
    });
    return response.data;
  }

  // ========== Admin user management ==========

  async listUsers(search?: string, page = 1, limit = 20): Promise<UserListResponse> {
    const params: Record<string, any> = { page, limit };
    if (search) params.search = search;
    const response = await this.authClient.get<UserListResponse>('/api/auth/users', { params });
    return response.data;
  }

  async createUser(data: AdminCreateUserRequest): Promise<User> {
    const response = await this.authClient.post<User>('/api/auth/users', data);
    return response.data;
  }

  async updateUser(id: string, data: AdminUpdateUserRequest): Promise<User> {
    const response = await this.authClient.put<User>(`/api/auth/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string): Promise<void> {
    await this.authClient.delete(`/api/auth/users/${id}`);
  }

  async impersonateUser(id: string): Promise<AuthResponse> {
    const response = await this.authClient.post<AuthResponse>(`/api/auth/users/${id}/impersonate`);
    return response.data;
  }

  // ========== Geo object methods ==========

  async getGeoObjects(type?: string, bbox?: { minLat: number, minLng: number, maxLat: number, maxLng: number, zoom?: number, clip?: boolean, filterByZoom?: boolean }, search?: string): Promise<GeoObjectListResponse> {
    const params: Record<string, any> = {};
    if (type) params.type = type;
    if (search) params.search = search;
    if (bbox) {
      params.minLat = bbox.minLat;
      params.minLng = bbox.minLng;
      params.maxLat = bbox.maxLat;
      params.maxLng = bbox.maxLng;
      if (bbox.zoom !== undefined) params.zoom = bbox.zoom;
      if (bbox.clip) params.clip = 'true';
      if (bbox.filterByZoom !== undefined) params.filterByZoom = bbox.filterByZoom ? 'true' : 'false';
    }
    const response = await this.mapClient.get<GeoObjectListResponse>('/api/map/objects', { params });
    return response.data;
  }

  async getGeoObjectById(id: string): Promise<GeoObject> {
    const response = await this.mapClient.get<GeoObject>(`/api/map/objects/${id}`);
    return response.data;
  }

  async createGeoObject(data: CreateGeoObjectRequest): Promise<GeoObject> {
    const response = await this.mapClient.post<GeoObject>('/api/map/objects', data);
    return response.data;
  }

  async updateGeoObject(id: string, data: UpdateGeoObjectRequest): Promise<GeoObject> {
    const response = await this.mapClient.put<GeoObject>(`/api/map/objects/${id}`, data);
    return response.data;
  }

  async deleteGeoObject(id: string): Promise<void> {
    await this.mapClient.delete(`/api/map/objects/${id}`);
  }

  async getGeoObjectHistory(id: string, limit = 50): Promise<any[]> {
    const response = await this.mapClient.get<any[]>(`/api/map/objects/${id}/history`, {
      params: { limit }
    });
    return response.data;
  }

  async getGeoObjectVersions(baseId: string): Promise<GeoObjectListResponse> {
    const response = await this.mapClient.get<GeoObjectListResponse>(`/api/map/versions/${baseId}`);
    return response.data;
  }

  async getGeoObjectVersionSnapshots(id: string): Promise<any[]> {
    const response = await this.mapClient.get<any[]>(`/api/map/object-versions/${id}`);
    return response.data;
  }

  async createGeoObjectVersion(id: string, data: { name: string; description?: string; metadata?: any; geometry: any }): Promise<any> {
    const response = await this.mapClient.post(`/api/map/object-versions/${id}`, data);
    return response.data;
  }

  async createGeoObjectVersionFromCurrent(id: string, data: { name: string; description?: string }): Promise<any> {
    const response = await this.mapClient.post(`/api/map/object-versions/${id}/current`, data);
    return response.data;
  }

  async rollbackToHistory(historyId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.mapClient.post<{ success: boolean; message: string }>(`/api/map/history/${historyId}/rollback`);
    return response.data;
  }

  getTileUrl(): string {
    const token = localStorage.getItem('token');
    return `${MAP_SERVICE_URL}/api/map/tiles/{z}/{x}/{y}.pbf${token ? `?token=${token}` : ''}`;
  }

  // ========== Stats ==========

  async getStats(): Promise<StatsResponse> {
    const response = await this.mapClient.get<StatsResponse>('/api/map/stats');
    return response.data;
  }

  // ========== Complaints ==========

  async createComplaint(data: CreateComplaintRequest): Promise<Complaint> {
    const response = await this.mapClient.post<Complaint>('/api/map/complaints', data);
    return response.data;
  }

  async listComplaints(status?: string, page = 1, limit = 20): Promise<ComplaintListResponse> {
    const params: Record<string, any> = { page, limit };
    if (status) params.status = status;
    const response = await this.mapClient.get<ComplaintListResponse>('/api/map/complaints', { params });
    return response.data;
  }

  async getComplaint(id: string): Promise<Complaint> {
    const response = await this.mapClient.get<Complaint>(`/api/map/complaints/${id}`);
    return response.data;
  }

  async updateComplaint(id: string, data: UpdateComplaintRequest): Promise<Complaint> {
    const response = await this.mapClient.put<Complaint>(`/api/map/complaints/${id}`, data);
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
