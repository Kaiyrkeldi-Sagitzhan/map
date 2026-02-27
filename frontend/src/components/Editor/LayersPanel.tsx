/**
 * LayersPanel.tsx — Left sidebar with tree-view of layers/features.
 * 280px fixed, scrollable, with visibility/lock toggles and editable names.
 */
import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { getSafeStyle, getSafeLabel } from '../../types/editor'
import type { EditorFeature } from '../../types/editor'
import { saveAs } from 'file-saver'
import { Download } from 'lucide-react'

export default function LayersPanel() {
    const {
        layers,
        features,
        selectedFeatureId,
        setSelectedFeature,
        toggleLayerVisibility,
        toggleLayerLock,
        toggleLayerExpand,
        toggleFeatureVisibility,
        toggleFeatureLock,
    } = useEditorStore()

    const handleExportAll = () => {
        if (features.length === 0) return
        const fc: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: features.map(f => ({
                type: 'Feature',
                properties: {
                    name: f.name,
                    class: f.featureClass,
                    description: f.description,
                },
                geometry: f.geometry,
            })),
        }
        const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' })
        saveAs(blob, `project_export_${new Date().toISOString().slice(0, 10)}.geojson`)
    }

    return (
        <div className="w-[280px] min-w-[280px] h-full bg-white/70 backdrop-blur-md border-r border-gray-200/50 flex flex-col z-[500] overflow-hidden shadow-xl">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="20" height="8" rx="1" /><rect x="2" y="14" width="20" height="8" rx="1" />
                    </svg>
                    Слои
                </h2>
                <button 
                    onClick={handleExportAll}
                    disabled={features.length === 0}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Экспорт всего проекта"
                >
                    <Download className="w-4 h-4" />
                </button>
            </div>

            {/* Tree view */}
            <div className="flex-1 overflow-y-auto py-2 min-h-0">
                {layers.length === 0 && (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
                            <rect x="2" y="2" width="20" height="20" rx="2" />
                            <line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        Нарисуйте объект на карте
                    </div>
                )}

                {layers.map((layer) => {
                    const layerFeatures = features.filter(
                        (f) => f.featureClass === layer.featureClass
                    )
                    return (
                        <div key={layer.id} className="mb-0.5">
                            {/* Layer header */}
                            <div
                                className={`
                  flex items-center gap-1.5 px-3 py-2 cursor-pointer
                  hover:bg-gray-50 transition-colors duration-100
                  ${!layer.visible ? 'opacity-50' : ''}
                `}
                                onClick={() => toggleLayerExpand(layer.id)}
                            >
                                {/* Expand/collapse chevron */}
                                <svg
                                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5"
                                    className={`transition-transform duration-200 text-gray-400 ${layer.expanded ? 'rotate-90' : ''
                                        }`}
                                >
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>

                                {/* Color dot */}
                                <span
                                    className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                                    style={{ backgroundColor: getSafeStyle(layer.featureClass).fillColor }}
                                />

                                {/* Name */}
                                <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                                    {getSafeLabel(layer.featureClass)}
                                </span>

                                {/* Count */}
                                <span className="text-xs text-gray-400 font-mono">
                                    {layerFeatures.length}
                                </span>

                                {/* Visibility */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id) }}
                                    className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                                    title={layer.visible ? 'Скрыть' : 'Показать'}
                                >
                                    {layer.visible ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                        </svg>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    )}
                                </button>

                                {/* Lock */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id) }}
                                    className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                                    title={layer.locked ? 'Разблокировать' : 'Заблокировать'}
                                >
                                    {layer.locked ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                                            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                                        </svg>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                                            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 019.9-1" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {/* Features list (expanded) */}
                            {layer.expanded && (
                                <div className="ml-5">
                                    {layerFeatures.map((feature) => (
                                        <FeatureItem
                                            key={feature.id}
                                            feature={feature}
                                            isSelected={feature.id === selectedFeatureId}
                                            onSelect={() => setSelectedFeature(feature.id)}
                                            onToggleVisibility={() => toggleFeatureVisibility(feature.id)}
                                            onToggleLock={() => toggleFeatureLock(feature.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Footer stats */}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-400">
                    {features.length} объект{features.length !== 1 ? 'ов' : ''} • {layers.length} сло{layers.length !== 1 ? 'ёв' : 'й'}
                </p>
            </div>
        </div>
    )
}

// ─── Feature item ──────────────────────────────────────────
function FeatureItem({
    feature,
    isSelected,
    onSelect,
    onToggleVisibility,
    onToggleLock,
}: {
    feature: EditorFeature
    isSelected: boolean
    onSelect: () => void
    onToggleVisibility: () => void
    onToggleLock: () => void
}) {
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(feature.name)
    const updateFeature = useEditorStore((s) => s.updateFeature)
    const deleteFeature = useEditorStore((s) => s.deleteFeature)

    const handleNameSubmit = () => {
        updateFeature(feature.id, { name })
        setEditing(false)
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        if (confirm(`Удалить объект "${feature.name}"?`)) {
            deleteFeature(feature.id)
        }
    }

    const geomIcon = getGeomIcon(feature.geometry.type)

    return (
        <div
            className={`
        flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer
        transition-colors duration-100
        ${isSelected
                    ? 'bg-indigo-50 border border-indigo-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }
        ${!feature.visible ? 'opacity-40' : ''}
      `}
            onClick={onSelect}
            onContextMenu={handleContextMenu}
        >
            {/* Geometry type icon */}
            <span className="text-gray-400 flex-shrink-0">{geomIcon}</span>

            {/* Name */}
            {editing ? (
                <input
                    className="flex-1 text-xs bg-white border border-indigo-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleNameSubmit}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit() }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                />
            ) : (
                <span
                    className="flex-1 text-xs text-gray-700 truncate"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
                >
                    {feature.name}
                </span>
            )}

            {/* Visibility */}
            <button
                onClick={(e) => { e.stopPropagation(); onToggleVisibility() }}
                className="p-0.5 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100"
                style={{ opacity: isSelected || !feature.visible ? 1 : undefined }}
            >
                {feature.visible ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                        <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                )}
            </button>

            {/* Lock */}
            <button
                onClick={(e) => { e.stopPropagation(); onToggleLock() }}
                className="p-0.5 rounded hover:bg-gray-200 transition-colors"
            >
                {feature.locked ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 019.9-1" />
                    </svg>
                )}
            </button>
        </div>
    )
}

// ─── Geometry icon helper ──────────────────────────────────
function getGeomIcon(type: string): JSX.Element {
    switch (type) {
        case 'Polygon':
        case 'MultiPolygon':
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l9 7-3.5 11h-11L3 9z" />
                </svg>
            )
        case 'LineString':
        case 'MultiLineString':
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="19" x2="19" y2="5" />
                </svg>
            )
        case 'Point':
        case 'MultiPoint':
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                </svg>
            )
        default:
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
            )
    }
}
