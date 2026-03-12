import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  GeoObject,
  GeoObjectListResponse,
  CreateGeoObjectRequest,
  UpdateGeoObjectRequest
} from '../types';

const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:8080';
const MAP_SERVICE_URL = import.meta.env.VITE_MAP_SERVICE_URL || 'http://localhost:8080';

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

    // Add auth interceptor to map client
    this.mapClient.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.mapClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
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

  async getCurrentUser(): Promise<{ id: string; email: string; role: string }> {
    const response = await this.authClient.get('/api/auth/me');
    return response.data;
  }

  // Geo object methods
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

  async rollbackToHistory(historyId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.mapClient.post<{ success: boolean; message: string }>(`/api/map/history/${historyId}/rollback`);
    return response.data;
  }

  getTileUrl(): string {
    const token = localStorage.getItem('token');
    return `${MAP_SERVICE_URL}/api/map/tiles/{z}/{x}/{y}.pbf${token ? `?token=${token}` : ''}`;
  }
}

export const apiService = new ApiService();
export default apiService;
