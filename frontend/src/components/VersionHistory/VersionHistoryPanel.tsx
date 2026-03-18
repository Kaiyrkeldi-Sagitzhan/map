import React, { useState, useEffect } from 'react';
import { geoObjectService } from '../../services/GeoObjectService';
import type { VersionListResponse, VersionInfo, GeoObject } from '../../types';

interface VersionHistoryPanelProps {
  objectId: string;
  onViewVersion: (version: GeoObject, versionNumber: number) => void;
  onCompareVersions: (v1: number, v2: number) => void;
  onCreateVersion: () => void;
  currentVersion: number;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  objectId,
  onViewVersion,
  onCompareVersions,
  onCreateVersion,
  currentVersion
}) => {
  const [versions, setVersions] = useState<VersionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  useEffect(() => {
    loadVersions();
  }, [objectId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const data = await geoObjectService.getVersions(objectId);
      setVersions(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const handleVersionClick = async (versionInfo: VersionInfo) => {
    try {
      const version = await geoObjectService.getVersionSnapshot(objectId, versionInfo.version_number);
      onViewVersion(version, versionInfo.version_number);
    } catch (err: any) {
      console.error('Failed to load version:', err);
    }
  };

  const handleSelectForCompare = (versionNumber: number) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionNumber)) {
        return prev.filter(v => v !== versionNumber);
      }
      if (prev.length >= 2) {
        return [prev[1], versionNumber];
      }
      return [...prev, versionNumber];
    });
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      onCompareVersions(selectedVersions[0], selectedVersions[1]);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('kk-KZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChangeIcon = (changed: boolean) => {
    return changed ? (
      <span className="text-red-500">●</span>
    ) : (
      <span className="text-gray-300">○</span>
    );
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-600 rounded-full"></div>
        <p className="mt-2">Загрузка истории...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>{error}</p>
        <button
          onClick={loadVersions}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!versions || versions.versions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>История версий пуста</p>
        <button
          onClick={onCreateVersion}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Создать версию
        </button>
      </div>
    );
  }

  return (
    <div className="version-history-panel">
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="text-lg font-semibold">История версий</h3>
        <button
          onClick={onCreateVersion}
          className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
        >
          + Версия
        </button>
      </div>

      {selectedVersions.length === 2 && (
        <div className="p-3 bg-blue-50 border-b flex justify-between items-center">
          <span className="text-sm text-blue-700">
            Выбрано: v{selectedVersions[0]} и v{selectedVersions[1]}
          </span>
          <button
            onClick={handleCompare}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Сравнить
          </button>
        </div>
      )}

      <div className="overflow-y-auto max-h-96">
        {versions.versions.map((version) => (
          <div
            key={version.id}
            className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
              version.version_number === currentVersion ? 'bg-green-50' : ''
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1" onClick={() => handleVersionClick(version)}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">v{version.version_number}</span>
                  {version.version_number === currentVersion && (
                    <span className="text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded">
                      Текущая
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDate(version.created_at)}
                </p>
                {version.change_description && (
                  <p className="text-sm mt-1 italic text-gray-600">
                    "{version.change_description}"
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedVersions.includes(version.version_number)}
                    onChange={() => handleSelectForCompare(version.version_number)}
                    className="rounded"
                  />
                  <span className="text-gray-500">Сравнить</span>
                </label>
              </div>
            </div>

            {/* Changes indicators */}
            <div className="flex gap-3 mt-2 text-xs">
              <span className="flex items-center gap-1">
                {getChangeIcon(version.changes.geometry)}
                <span>Геометрия</span>
              </span>
              <span className="flex items-center gap-1">
                {getChangeIcon(version.changes.name)}
                <span>Имя</span>
              </span>
              <span className="flex items-center gap-1">
                {getChangeIcon(version.changes.description)}
                <span>Описание</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t text-sm text-gray-500">
        Всего версий: {versions.total} | Текущая: v{versions.current_version}
      </div>
    </div>
  );
};

export default VersionHistoryPanel;
