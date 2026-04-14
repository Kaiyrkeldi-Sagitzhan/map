import React, { useEffect, useState } from 'react';
import { geoObjectService } from '../../services/GeoObjectService';
import type { VersionCompareResult } from '../../types';

interface VersionCompareViewProps {
  objectId: string;
  v1: number;
  v2: number;
  onClose: () => void;
}

export const VersionCompareView: React.FC<VersionCompareViewProps> = ({
  objectId,
  v1,
  v2,
  onClose
}) => {
  const [compareResult, setCompareResult] = useState<VersionCompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadComparison();
  }, [objectId, v1, v2]);

  const loadComparison = async () => {
    try {
      setLoading(true);
      const data = await geoObjectService.compareVersions(objectId, v1, v2);
      setCompareResult(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to compare versions');
    } finally {
      setLoading(false);
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

  const getChangeIndicator = (changed: boolean, label: string) => {
    return (
      <div className={`flex items-center gap-2 ${changed ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
        <span className={`w-4 h-4 flex items-center justify-center rounded-full text-xs ${
          changed ? 'bg-red-100' : 'bg-gray-100'
        }`}>
          {changed ? '!' : '✓'}
        </span>
        <span>{label}</span>
        {changed && <span className="text-xs text-red-500">(Изменено)</span>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full"></div>
          <p className="mt-2 text-gray-600">Сравнение версий...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <p className="text-red-500">{error}</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={loadComparison}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Повторить
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!compareResult) return null;

  const { version1, version2, diff } = compareResult;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-xl font-semibold">
            Сравнение версий v{v1} и v{v2}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Changes summary */}
        <div className="p-4 border-b bg-yellow-50">
          <h3 className="font-medium mb-2">Изменения:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {getChangeIndicator(diff.geometry_changed, 'Геометрия')}
            {getChangeIndicator(diff.name_changed, 'Название')}
            {getChangeIndicator(diff.description_changed, 'Описание')}
            {getChangeIndicator(diff.type_changed, 'Тип')}
            {getChangeIndicator(diff.scope_changed, 'Область видимости')}
            {getChangeIndicator(diff.metadata_changed, 'Метаданные')}
          </div>
          {diff.geometry_diff && (
            <div className="mt-2 text-sm text-gray-600">
              Геометрия: {diff.geometry_diff.old_coords_count} → {diff.geometry_diff.new_coords_count} координат
            </div>
          )}
        </div>

        {/* Side by side comparison */}
        <div className="grid grid-cols-2 divide-x max-h-[60vh] overflow-y-auto">
          {/* Version 1 */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <span className="px-2 py-1 bg-gray-200 rounded text-sm font-medium">
                Версия v{v1}
              </span>
              <span className="text-sm text-gray-500">
                {version1 && formatDate(version1.created_at)}
              </span>
            </div>
            
            {version1 ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Название</label>
                  <p className={diff.name_changed ? 'text-red-600 font-medium' : ''}>
                    {version1.name}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Тип</label>
                  <p className={diff.type_changed ? 'text-red-600 font-medium' : ''}>
                    {version1.type}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Область видимости</label>
                  <p className={diff.scope_changed ? 'text-red-600 font-medium' : ''}>
                    {version1.scope}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Описание</label>
                  <p className={`${diff.description_changed ? 'text-red-600 font-medium' : ''} text-sm`}>
                    {version1.description || '-'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Геометрия</label>
                  <p className={`text-xs ${diff.geometry_changed ? 'text-red-600' : 'text-gray-500'}`}>
                    {diff.geometry_diff ? `${diff.geometry_diff.old_coords_count} координат` : '-'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Нет данных</p>
            )}
          </div>

          {/* Version 2 */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <span className="px-2 py-1 bg-blue-200 rounded text-sm font-medium">
                Версия v{v2}
              </span>
              <span className="text-sm text-gray-500">
                {version2 && formatDate(version2.created_at)}
              </span>
            </div>

            {version2 ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Название</label>
                  <p className={diff.name_changed ? 'text-blue-600 font-medium' : ''}>
                    {version2.name}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Тип</label>
                  <p className={diff.type_changed ? 'text-blue-600 font-medium' : ''}>
                    {version2.type}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Область видимости</label>
                  <p className={diff.scope_changed ? 'text-blue-600 font-medium' : ''}>
                    {version2.scope}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Описание</label>
                  <p className={`${diff.description_changed ? 'text-blue-600 font-medium' : ''} text-sm`}>
                    {version2.description || '-'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Геометрия</label>
                  <p className={`text-xs ${diff.geometry_changed ? 'text-blue-600' : 'text-gray-500'}`}>
                    {diff.geometry_diff ? `${diff.geometry_diff.new_coords_count} координат` : '-'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Нет данных</p>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 border-t bg-gray-50 text-sm text-gray-600">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span>
              Старая версия
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></span>
              Новая версия
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionCompareView;
