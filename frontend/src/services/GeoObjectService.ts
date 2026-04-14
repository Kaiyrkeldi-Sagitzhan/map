import { apiService } from './api';
import type { GeoObject, VersionListResponse, VersionCompareResult, VersionInfo, CreateGeoObjectRequest, UpdateGeoObjectRequest } from '../types';

/**
 * GeoObjectService provides methods for managing geo object versions and history
 */
class GeoObjectService {
  /**
   * Get version list for a geo object
   */
  async getVersions(objectId: string): Promise<VersionListResponse> {
    try {
      const history = await apiService.getGeoObjectHistory(objectId, 100);
      
      // Transform history entries to version info
      const versions: VersionInfo[] = history.map((entry: any, index: number) => ({
        id: entry.id,
        version_number: index + 1,
        object_id: objectId,
        user_id: entry.userId || '',
        change_description: entry.description || '',
        changes: {
          geometry: true,
          name: !!entry.afterSnapshot?.name,
          description: !!entry.afterSnapshot?.description,
          type: !!entry.afterSnapshot?.type,
          scope: !!entry.afterSnapshot?.scope,
          metadata: !!entry.afterSnapshot?.metadata,
        },
        created_at: entry.createdAt || entry.created_at || new Date().toISOString(),
      }));

      return {
        versions,
        total: versions.length,
        current_version: versions.length || 1,
      };
    } catch (error) {
      console.error('Failed to get versions:', error);
      return {
        versions: [],
        total: 0,
        current_version: 1,
      };
    }
  }

  /**
   * Get a specific version snapshot
   */
  async getVersionSnapshot(objectId: string, _versionNumber: number): Promise<GeoObject> {
    try {
      // Get the current object and return it as the snapshot
      // In a full implementation, this would fetch from a versions endpoint
      const obj = await apiService.getGeoObjectById(objectId);
      return obj;
    } catch (error) {
      console.error('Failed to get version snapshot:', error);
      throw error;
    }
  }

  /**
   * Compare two versions
   */
  async compareVersions(objectId: string, _v1: number, _v2: number): Promise<VersionCompareResult> {
    try {
      const obj = await apiService.getGeoObjectById(objectId);
      
      // For now, compare current object with itself as a placeholder
      // A full implementation would need backend support for version comparison
      return {
        version1: obj,
        version2: obj,
        diff: {
          geometry_changed: false,
          name_changed: false,
          description_changed: false,
          type_changed: false,
          scope_changed: false,
          metadata_changed: false,
        },
      };
    } catch (error) {
      console.error('Failed to compare versions:', error);
      throw error;
    }
  }

  /**
   * Get geo object by ID
   */
  async getById(id: string): Promise<GeoObject> {
    return apiService.getGeoObjectById(id);
  }

  /**
   * Create a new geo object
   */
  async create(data: CreateGeoObjectRequest): Promise<GeoObject> {
    return apiService.createGeoObject(data);
  }

  /**
   * Update a geo object
   */
  async update(id: string, data: UpdateGeoObjectRequest): Promise<GeoObject> {
    return apiService.updateGeoObject(id, data);
  }

  /**
   * Delete a geo object
   */
  async delete(id: string): Promise<void> {
    return apiService.deleteGeoObject(id);
  }

  /**
   * Rollback to a specific history entry
   */
  async rollback(historyId: string): Promise<{ success: boolean; message: string }> {
    return apiService.rollbackToHistory(historyId);
  }
}

export const geoObjectService = new GeoObjectService();
export default geoObjectService;
