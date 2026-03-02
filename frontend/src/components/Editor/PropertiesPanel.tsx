/**
 * PropertiesPanel.tsx — Right sidebar for selected feature properties.
 * 320px fixed, shown only when a feature is selected.
 * Includes name, class, colors, stroke width, opacity, description, geometry info, export.
 */
import { useState, useEffect, useMemo } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { getSafeLabel, getSafeStyle } from '../../types/editor'
import type { FeatureClass, ClassStyle } from '../../types/editor'
import { saveAs } from 'file-saver'
import { apiService } from '../../services/api'

const featureClasses: FeatureClass[] = ['lake', 'river', 'forest', 'road', 'building', 'city', 'other', 'custom']

export default function PropertiesPanel() {
    const {
        selectedFeatureId,
        features,
        updateFeature,
        deleteFeature,
        duplicateFeature,
        setSelectedFeature,
    } = useEditorStore()

    const feature = features.find((f) => f.id === selectedFeatureId)

    // Local editable state synced to store
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [style, setStyle] = useState<ClassStyle>({ color: '#000', fillColor: '#000', weight: 2, fillOpacity: 0.3 })
    const [fc, setFc] = useState<FeatureClass>('custom')

    // Sync local state when feature changes
    useEffect(() => {
        if (feature) {
            setName(feature.name)
            setDescription(feature.description)
            setStyle(feature.style)
            setFc(feature.featureClass)
        }
    }, [feature])

    // Persist to backend
    async function persistUpdate(patch: Record<string, any>) {
        if (feature?.backendId) {
            apiService.updateGeoObject(feature.backendId, patch).catch(console.error)
        }
    }

    // ─── Handlers ─────────────────────────────────────────────
    const handleNameBlur = () => {
        if (!feature) return
        updateFeature(feature.id, { name })
        persistUpdate({ name })
    }

    const handleDescBlur = () => {
        if (!feature) return
        updateFeature(feature.id, { description })
        persistUpdate({ description })
    }

    const handleClassChange = (newFc: FeatureClass) => {
        if (!feature) return
        const newStyle = { ...getSafeStyle(newFc) }
        setFc(newFc)
        setStyle(newStyle)
        updateFeature(feature.id, { featureClass: newFc, style: newStyle })
        persistUpdate({ type: newFc as any, metadata: { style: newStyle } })
    }

    const handleStyleChange = (key: keyof ClassStyle, value: string | number) => {
        if (!feature) return
        const newStyle = { ...style, [key]: value }
        setStyle(newStyle)
        updateFeature(feature.id, { style: newStyle })
        persistUpdate({ metadata: { style: newStyle } })
    }

    const handleDelete = () => {
        if (!feature) return
        if (feature.backendId) {
            apiService.deleteGeoObject(feature.backendId).catch(console.error)
        }
        deleteFeature(feature.id)
    }

    const handleDuplicate = () => {
        if (!feature) return
        duplicateFeature(feature.id)
    }

    const handleClose = () => {
        setSelectedFeature(null)
    }

    // ─── Geometry info ────────────────────────────────────────
    const geomInfo = useMemo(() => {
        if (!feature) return { type: 'Unknown', coordCount: 0 }
        const g = feature.geometry
        const type = g.type
        let coordCount = 0
        if ('coordinates' in g) {
            coordCount = countCoords(g.coordinates)
        }
        return { type, coordCount }
    }, [feature])

    // No feature selected - RETURN ONLY AFTER ALL HOOKS
    if (!feature) return (
        <div className="w-[320px] min-w-[320px] h-full bg-white/70 backdrop-blur-md border-l border-gray-200/50 flex flex-col z-[500] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Свойства</h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-400">
                        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                        <path d="M13 13l6 6" />
                    </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">Объект не выбран</p>
                <p className="text-xs text-gray-500">Нажмите на объект на карте, чтобы увидеть и отредактировать его свойства</p>
            </div>
        </div>
    )

    // ─── Export handlers ──────────────────────────────────────
    const exportGeoJSON = () => {
        const fc: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: {
                    class: feature.featureClass,
                    name: feature.name,
                    description: feature.description,
                },
                geometry: feature.geometry,
            }],
        }
        const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' })
        saveAs(blob, `${feature.name.replace(/\s+/g, '_')}.geojson`)
    }

    const exportSVG = () => {
        const svg = geometryToSVG(feature.geometry, feature.style)
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        saveAs(blob, `${feature.name.replace(/\s+/g, '_')}.svg`)
    }

    const exportPNG = () => {
        const svg = geometryToSVG(feature.geometry, feature.style)
        const svgBlob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(svgBlob)
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width || 800
            canvas.height = img.height || 600
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.fillStyle = '#fff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(img, 0, 0)
            }
            canvas.toBlob((blob) => {
                if (blob) saveAs(blob, `${feature.name.replace(/\s+/g, '_')}.png`)
            })
            URL.revokeObjectURL(url)
        }
        img.src = url
    }

    return (
        <div className="w-[320px] min-w-[320px] h-full bg-white/70 backdrop-blur-md border-l border-gray-200/50 flex flex-col z-[500] overflow-hidden shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/50">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Свойства</h2>
                <button
                    onClick={handleClose}
                    className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {/* Name */}
                <div className="px-4 py-3 border-b border-gray-200">
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Название</label>
                    <input
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleNameBlur}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleNameBlur() }}
                    />
                </div>

                {/* Class */}
                <div className="px-4 py-3 border-b border-gray-200">
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Класс</label>
                    <select
                        value={fc}
                        onChange={(e) => handleClassChange(e.target.value as FeatureClass)}
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    >
                        {featureClasses.map((c) => (
                            <option key={c} value={c}>{getSafeLabel(c)}</option>
                        ))}
                    </select>
                </div>

                {/* Colors */}
                <div className="px-4 py-3 border-b border-gray-200">
                    <label className="text-xs font-medium text-gray-700 mb-2 block">Цвета</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-600">Обводка</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="color"
                                    value={style.color}
                                    onChange={(e) => handleStyleChange('color', e.target.value)}
                                    className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
                                />
                                <span className="text-xs text-gray-700 font-mono">{style.color}</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-600">Заливка</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="color"
                                    value={style.fillColor}
                                    onChange={(e) => handleStyleChange('fillColor', e.target.value)}
                                    className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
                                />
                                <span className="text-xs text-gray-700 font-mono">{style.fillColor}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stroke width & opacity */}
                <div className="px-4 py-3 border-b border-gray-200">
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs text-gray-600">Толщина линии</label>
                                <span className="text-xs text-gray-600 font-mono">{style.weight}px</span>
                            </div>
                            <input
                                type="range" min="1" max="10" step="0.5"
                                value={style.weight}
                                onChange={(e) => handleStyleChange('weight', parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs text-gray-600">Прозрачность заливки</label>
                                <span className="text-xs text-gray-600 font-mono">{Math.round(style.fillOpacity * 100)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={style.fillOpacity}
                                onChange={(e) => handleStyleChange('fillOpacity', parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDuplicate}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors border border-gray-200"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                            Дублировать
                        </button>
                        <button
                            onClick={handleDelete}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                            Удалить
                        </button>
                    </div>
                </div>

                {/* Geometry info */}
                <div className="px-4 py-3 border-b border-gray-200">
                    <label className="text-xs font-medium text-gray-700 mb-2 block">Геометрия</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-50 rounded-lg p-2">
                            <span className="text-gray-600 block">Тип</span>
                            <span className="text-gray-800 font-medium">{geomInfo.type}</span>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                            <span className="text-gray-600 block">Координат</span>
                            <span className="text-gray-800 font-medium">{geomInfo.coordCount}</span>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div className="px-4 py-3 border-b border-gray-200">
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Описание</label>
                    <textarea
                        rows={4}
                        placeholder="Подробное описание реки, озера, рельефа..."
                        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none transition-colors"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={handleDescBlur}
                    />
                </div>

                {/* Advanced Metadata */}
                {feature.metadata && Object.keys(feature.metadata).length > 0 && (
                    <div className="px-4 py-3 border-b border-gray-200 bg-indigo-50/20">
                        <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2 block">Дополнительные сведения</label>
                        <div className="space-y-1.5">
                            {Object.entries(feature.metadata).map(([key, value]) => {
                                if (value === null || value === '' || key === 'osm_id' || key === 'code') return null
                                return (
                                    <div key={key} className="flex justify-between text-[11px]">
                                        <span className="text-gray-400 font-medium">{key}:</span>
                                        <span className="text-gray-700 font-semibold">{String(value)}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Export */}
                <div className="overflow-hidden">
                    <div className="bg-indigo-600 px-4 py-2">
                        <label className="text-xs font-bold text-white uppercase tracking-wider">Экспорт выделенного</label>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-3">
                        <button
                            onClick={exportGeoJSON}
                            className="flex flex-col items-center gap-1.5 px-2 py-4 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors border border-emerald-200"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                            </svg>
                            GeoJSON
                        </button>
                        <button
                            onClick={exportSVG}
                            className="flex flex-col items-center gap-1.5 px-2 py-4 text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors border border-purple-200"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                            </svg>
                            SVG
                        </button>
                        <button
                            onClick={exportPNG}
                            className="flex flex-col items-center gap-1.5 px-2 py-4 text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg transition-colors border border-sky-200"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            PNG
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Helpers ────────────────────────────────────────────────
function countCoords(coords: any): number {
    if (typeof coords[0] === 'number') return 1
    if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') return coords.length
    let count = 0
    for (const c of coords) count += countCoords(c)
    return count
}

function geometryToSVG(geometry: GeoJSON.Geometry, style: ClassStyle): string {
    const coords = extractAllCoords(geometry)
    if (coords.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>'

    const xs = coords.map((c) => c[0])
    const ys = coords.map((c) => c[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const width = maxX - minX || 1
    const height = maxY - minY || 1
    const padding = 20
    const svgW = 800, svgH = 600
    const scaleX = (svgW - padding * 2) / width
    const scaleY = (svgH - padding * 2) / height
    const scale = Math.min(scaleX, scaleY)

    const transform = (c: number[]): [number, number] => [
        padding + (c[0] - minX) * scale,
        svgH - padding - (c[1] - minY) * scale, // flip Y
    ]

    let pathD = ''
    if (geometry.type === 'Polygon') {
        for (const ring of (geometry as GeoJSON.Polygon).coordinates) {
            pathD += ring.map((c: number[], i: number) => {
                const [x, y] = transform(c)
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
            }).join(' ') + ' Z '
        }
    } else if (geometry.type === 'LineString') {
        pathD = (geometry as GeoJSON.LineString).coordinates.map((c: number[], i: number) => {
            const [x, y] = transform(c)
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
        }).join(' ')
    } else if (geometry.type === 'Point') {
        const [x, y] = transform((geometry as GeoJSON.Point).coordinates as number[])
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">
      <circle cx="${x}" cy="${y}" r="8" fill="${style.fillColor}" stroke="${style.color}" stroke-width="${style.weight}" opacity="${style.fillOpacity}" />
    </svg>`
    } else {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="10" y="50" font-size="10">Complex geometry</text></svg>`
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">
    <path d="${pathD}" fill="${style.fillColor}" fill-opacity="${style.fillOpacity}" stroke="${style.color}" stroke-width="${style.weight}" />
  </svg>`
}

function extractAllCoords(geometry: GeoJSON.Geometry): number[][] {
    switch (geometry.type) {
        case 'Point': return [(geometry as GeoJSON.Point).coordinates as number[]]
        case 'MultiPoint': return (geometry as GeoJSON.MultiPoint).coordinates as number[][]
        case 'LineString': return (geometry as GeoJSON.LineString).coordinates as number[][]
        case 'MultiLineString': return ((geometry as GeoJSON.MultiLineString).coordinates as number[][][]).flat()
        case 'Polygon': return ((geometry as GeoJSON.Polygon).coordinates as number[][][]).flat()
        case 'MultiPolygon': return ((geometry as GeoJSON.MultiPolygon).coordinates as number[][][][]).flat(2)
        default: return []
    }
}
