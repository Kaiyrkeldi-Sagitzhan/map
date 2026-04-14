/**
 * ViewerPropertiesPanel.tsx — Right sidebar for the viewer.
 * Same floating glassmorphic style as editor's PropertiesPanel.
 * Displays feature properties read-only (no inputs, no save/delete).
 */
import { useMemo, useState, useEffect } from 'react'
import { useViewerStore } from '../../store/viewerStore'
import { X, Box, Type, Layers, Settings2, Activity, ChevronRight, Clock, History, ZoomIn, MousePointer2 } from 'lucide-react'
import { FEATURE_SCHEMAS } from '../../types/schema'

const CLASS_LABELS: Record<string, string> = {
    lake: 'Озеро', river: 'Река', forest: 'Лес', road: 'Дорога',
    building: 'Здание', city: 'Нас. пункт', mountain: 'Гора',
    boundary: 'Граница', other: 'Другое', custom: 'Свой тип',
}

const normalizeFeatureType = (t: string) => {
    const low = t.toLowerCase().trim()
    if (low === 'water' || low === 'reservoir') return 'lake'
    if (low === 'peak') return 'mountain'
    return low
}

const getFeatureSchema = (feature: any) => {
    if (!feature) return null
    const specificFclass = feature.metadata?.fclass ? normalizeFeatureType(String(feature.metadata.fclass)) : null
    if (specificFclass && FEATURE_SCHEMAS[specificFclass]) return FEATURE_SCHEMAS[specificFclass]
    const genericClass = normalizeFeatureType(feature.type)
    return FEATURE_SCHEMAS[genericClass] || FEATURE_SCHEMAS['other']
}

export default function ViewerPropertiesPanel() {
    const selectedFeature = useViewerStore((s) => s.selectedFeature)
    const selectedFeatures = useViewerStore((s) => s.selectedFeatures)
    const selectedFeatureIds = useViewerStore((s) => s.selectedFeatureIds)
    const setPrimarySelectedFeature = useViewerStore((s) => s.setPrimarySelectedFeature)
    const clearSelection = useViewerStore((s) => s.clearSelection)
    const serverHistory = useViewerStore((s) => s.serverHistory)
    const fetchFeatureHistory = useViewerStore((s) => s.fetchFeatureHistory)
    const setHighlight = useViewerStore((s) => s.setHighlight)
    const clearHighlight = useViewerStore((s) => s.clearHighlight)
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const [activeTab, setActiveTab] = useState<'info' | 'history'>('info')
    const [isCollapsed, setIsCollapsed] = useState(false)

    const toggleExpanded = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const schema = useMemo(() => {
        return getFeatureSchema(selectedFeature)
    }, [selectedFeature?.type, selectedFeature?.metadata])

    const geomInfo = useMemo(() => {
        if (!selectedFeature?.geometry) return { type: 'Unknown', coordCount: 0 }
        const g = selectedFeature.geometry
        let count = 0
        if ('coordinates' in g) count = countCoords(g.coordinates)
        return { type: g.type, coordCount: count }
    }, [selectedFeature])

    const areaLabel = useMemo(() => {
        return formatAreaKm2(selectedFeature?.metadata?.area_km2)
    }, [selectedFeature?.metadata])

    useEffect(() => {
        if (activeTab === 'history' && selectedFeature) {
            fetchFeatureHistory(selectedFeature.backendId || selectedFeature.id)
        }
    }, [activeTab, selectedFeature?.id, selectedFeature?.backendId, fetchFeatureHistory])

    const handleHistoryHover = (entry: any) => {
        const snapshot = entry.afterSnapshot || entry.beforeSnapshot
        if (snapshot?.geometry) {
            setHighlight(snapshot.geometry, { color: '#3b82f6', fillColor: '#3b82f6', weight: 4, fillOpacity: 0.25, dashArray: '8,4' })
        }
    }

    const handleHistoryLeave = () => {
        if (selectedFeature?.geometry) {
            setHighlight(selectedFeature.geometry, {
                color: '#ff4500',
                fillColor: '#ff4500',
                weight: 4,
                fillOpacity: 0.25,
            })
        } else {
            clearHighlight()
        }
    }

    const handleHistoryClick = (entry: any) => {
        const snapshot = entry.afterSnapshot || entry.beforeSnapshot
        if (snapshot?.geometry) {
            setHighlight(snapshot.geometry, { color: '#f59e0b', fillColor: '#f59e0b', weight: 4, fillOpacity: 0.3, dashArray: '6,6' })
            const map = (window as any).leafletMap
            if (map) {
                try {
                    const L = (window as any).L
                    if (L) {
                        const layer = L.geoJSON({ type: 'Feature', properties: {}, geometry: snapshot.geometry })
                        const bounds = layer.getBounds()
                        if (bounds.isValid()) {
                            map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 })
                        }
                    }
                } catch {
                    // ignore map-fit errors
                }
            }
        }
    }

    if (selectedFeatureIds.length > 1) {
        if (isCollapsed) {
            return (
                <div className="fixed top-28 right-6 z-[500] w-12 h-12 rounded-xl bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="w-full h-full flex items-center justify-center text-[#10B981] hover:text-white transition-colors"
                        title="Открыть инспектор"
                    >
                        <Box size={16} />
                    </button>
                </div>
            )
        }

        return (
            <div className="fixed top-28 right-6 bottom-28 w-[320px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px]">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                        <h2 className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.2em]">Выбрано: {selectedFeatureIds.length}</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setIsCollapsed(true)} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><ChevronRight size={16} /></button>
                        <button onClick={clearSelection} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={16} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-6 space-y-2">
                    {selectedFeatures.map((feature) => {
                        return (
                            <ViewerMultiSelectItem
                                key={feature.backendId || feature.id}
                                feature={feature}
                                isExpanded={expandedIds.has(feature.backendId || feature.id)}
                                onToggleExpand={() => toggleExpanded(feature.backendId || feature.id)}
                                onSelect={() => setPrimarySelectedFeature(feature)}
                            />
                        )
                    })}
                </div>
            </div>
        )
    }

    if (!selectedFeature) {
        if (isCollapsed) {
            return (
                <div className="fixed top-28 right-6 z-[500] w-12 h-12 rounded-xl bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="w-full h-full flex items-center justify-center text-[#10B981] hover:text-white transition-colors"
                        title="Открыть инспектор"
                    >
                        <Box size={16} />
                    </button>
                </div>
            )
        }

        return (
            <div className="fixed top-28 right-6 bottom-28 w-[320px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px]">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                    <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Свойства объекта</h2>
                    <button onClick={() => setIsCollapsed(true)} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><ChevronRight size={16} /></button>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-in fade-in duration-500">
                    <div className="w-20 h-20 rounded-[32px] bg-[#10B981]/5 flex items-center justify-center mb-6 border border-[#10B981]/10">
                        <Box size={32} className="text-[#10B981]/20" />
                    </div>
                    <p className="text-sm font-bold text-slate-200 mb-2">Объект не выбран</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-[180px]">Выберите элемент на карте или используйте поиск, чтобы увидеть его свойства</p>
                </div>
            </div>
        )
    }

    const metadata = selectedFeature.metadata || {}
    const style = selectedFeature.style

    return (
        <div className={`fixed top-28 right-6 z-[500] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] transition-all duration-300 ${isCollapsed ? 'w-12 h-12 rounded-xl' : 'bottom-28 w-[320px] rounded-[24px]'}`}>
            {isCollapsed ? (
                <button
                    onClick={() => setIsCollapsed(false)}
                    className="w-full h-full flex items-center justify-center text-[#10B981] hover:text-white transition-colors"
                    title="Открыть инспектор"
                >
                    <Box size={16} />
                </button>
            ) : (
            <>
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                    <h2 className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.2em]">Инспектор</h2>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsCollapsed(true)} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><ChevronRight size={16} /></button>
                    <button onClick={clearSelection} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={16} /></button>
                </div>
            </div>

            <div className="px-4 pt-3">
                <div className="flex bg-black/40 rounded-xl p-1">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'info' ? 'bg-[#10B981] text-[#020C1B] shadow-lg shadow-[#10B981]/20' : 'text-slate-500 hover:text-white'}`}
                    >
                        <Box size={14} /> Инфо
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'history' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-white'}`}
                    >
                        <Clock size={14} /> История
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-6 space-y-6">
                {activeTab === 'info' ? (
                <>
                {/* Name & Type */}
                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-[9px] font-bold text-white/90 uppercase tracking-widest mb-1.5 ml-1">
                            <Type size={12} className="text-[#10B981]" /> Название
                        </label>
                        <div className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white">
                            {selectedFeature.name || 'Без названия'}
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-[9px] font-bold text-white/90 uppercase tracking-widest mb-1.5 ml-1">
                            <Layers size={12} className="text-[#10B981]" /> Классификация
                        </label>
                        <div className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white">
                            {CLASS_LABELS[selectedFeature.type] || selectedFeature.type}
                        </div>
                    </div>
                </div>

                {/* Description */}
                {selectedFeature.description && (
                    <div className="pt-4 border-t border-white/5">
                        <label className="text-[9px] font-bold text-white/50 uppercase tracking-widest mb-1.5 ml-1 block">Описание</label>
                        <div className="text-xs bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-slate-300 leading-relaxed">
                            {selectedFeature.description}
                        </div>
                    </div>
                )}

                {/* Style Preview */}
                {style && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <label className="flex items-center gap-2 text-[9px] font-bold text-white/90 uppercase tracking-widest ml-1">
                            <Settings2 size={12} className="text-[#10B981]" /> Оформление
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-2 text-center">Контур</label>
                                <div className="flex items-center justify-center">
                                    <div className="w-10 h-10 rounded-full border-2 border-white/20 shadow-lg" style={{ backgroundColor: style.color || '#666' }} />
                                </div>
                            </div>
                            <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-2 text-center">Заливка</label>
                                <div className="flex items-center justify-center">
                                    <div className="w-10 h-10 rounded-full border-2 border-white/20 shadow-lg" style={{ backgroundColor: style.fillColor || 'transparent' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Metadata (from schema) */}
                {schema && schema.fields && schema.fields.length > 0 && (
                    <div className="pt-4 border-t border-white/5 space-y-4">
                        <label className="flex items-center gap-2 text-[9px] font-bold text-white/60 uppercase tracking-widest ml-1">
                            <Activity size={12} className="text-[#10B981]/60" /> Параметры {schema.label}
                        </label>
                        <div className="space-y-3">
                            {schema.fields.map((field: any) => {
                                const value = metadata[field.key]
                                if (value === undefined || value === null || value === '') return null
                                return (
                                    <div key={field.key} className="flex items-center justify-between bg-white/[0.03] rounded-xl px-4 py-2.5 border border-white/5">
                                        <div className="flex items-center gap-2">
                                            {field.icon && <field.icon size={10} className="text-slate-600" />}
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">{field.label}</span>
                                        </div>
                                        <span className="text-[11px] text-white font-mono font-bold">
                                            {typeof value === 'boolean' ? (value ? 'Да' : 'Нет') : String(value)}
                                            {field.unit && <span className="text-slate-500 ml-1 text-[9px]">{field.unit}</span>}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Geometry Info */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                    <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest ml-1">Информация</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                            <span className="text-[8px] font-bold text-slate-600 uppercase block mb-1">Тип</span>
                            <span className="text-[10px] text-slate-200 font-mono font-bold uppercase tracking-tight">{geomInfo.type}</span>
                        </div>
                        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                            <span className="text-[8px] font-bold text-slate-600 uppercase block mb-1">Вершины</span>
                            <span className="text-[10px] text-slate-200 font-mono font-bold">{geomInfo.coordCount}</span>
                        </div>
                        {areaLabel && (
                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 col-span-2">
                                <span className="text-[8px] font-bold text-slate-600 uppercase block mb-1">Площадь</span>
                                <span className="text-[10px] text-slate-200 font-mono font-bold">{areaLabel}</span>
                            </div>
                        )}
                    </div>
                </div>
                </>
                ) : (
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {!selectedFeatureIds.length ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-5 border border-white/5">
                                <MousePointer2 size={24} className="text-slate-700 opacity-50" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Объект не выбран</p>
                        </div>
                    ) : serverHistory.length > 0 ? (
                        <div className="relative pl-4 mt-2">
                            <div className="absolute left-1 top-2 bottom-2 w-px bg-gradient-to-b from-[#10B981] via-white/10 to-transparent" />
                            <div className="space-y-4">
                                {[...serverHistory]
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((entry, idx) => {
                                        const isLatest = idx === 0
                                        const hasSnapshot = !!(entry.afterSnapshot?.geometry || entry.beforeSnapshot?.geometry)
                                        return (
                                            <div
                                                key={entry.id}
                                                className="relative group"
                                                onMouseEnter={() => hasSnapshot && handleHistoryHover(entry)}
                                                onMouseLeave={handleHistoryLeave}
                                            >
                                                <div className={`absolute -left-[15px] top-2.5 w-2 h-2 rounded-full border z-10 transition-all duration-300 ${isLatest ? 'bg-[#10B981] border-white scale-125 shadow-[0_0_10px_#10B981]' : 'bg-slate-900 border-slate-700 group-hover:bg-blue-500 group-hover:border-blue-400 group-hover:shadow-[0_0_8px_#3b82f6]'}`} />

                                                <div
                                                    className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer ${isLatest ? 'bg-white/10 border-[#10B981]/30 shadow-lg' : 'bg-white/[0.03] border-transparent hover:bg-white/[0.08] hover:border-blue-500/30'}`}
                                                    onClick={() => hasSnapshot && handleHistoryClick(entry)}
                                                >
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-blue-500/10 text-blue-300">
                                                            {entry.action}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            {hasSnapshot && <ZoomIn size={10} className="text-slate-700 group-hover:text-blue-400 transition-colors" />}
                                                            <span className="text-[9px] text-slate-500 font-mono">{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] font-medium text-slate-200 leading-snug">{entry.description}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <History size={32} className="text-slate-700 mb-4 opacity-20" />
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">История пуста</p>
                        </div>
                    )}
                </div>
                )}
            </div>
            </>
            )}
        </div>
    )
}

function countCoords(coords: any): number {
    if (typeof coords[0] === 'number') return 1
    if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') return coords.length
    let count = 0; for (const c of coords) count += countCoords(c)
    return count
}

function ViewerMultiSelectItem({
    feature,
    isExpanded,
    onToggleExpand,
    onSelect,
}: {
    feature: any
    isExpanded: boolean
    onToggleExpand: () => void
    onSelect: () => void
}) {
    if (!feature) return null

    const metadata = feature.metadata || {}
    const style = feature.style || metadata.style
    const schema = getFeatureSchema(feature)
    const geomInfo = (() => {
        if (!feature.geometry) return { type: 'Unknown', coordCount: 0 }
        const g = feature.geometry
        let count = 0
        if ('coordinates' in g) count = countCoords(g.coordinates)
        return { type: g.type, coordCount: count }
    })()
    const areaLabel = formatAreaKm2(feature?.metadata?.area_km2)

    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
            <button
                onClick={() => {
                    onSelect()
                    onToggleExpand()
                }}
                className="w-full flex items-center justify-between p-3 hover:bg-white/[0.08] transition-all"
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronRight
                        size={14}
                        className={`text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                    <div className="min-w-0 flex-1 text-left">
                        <p className="text-[10px] font-bold text-white truncate">{feature.name || 'Без названия'}</p>
                        <p className="text-[8px] text-slate-500">{CLASS_LABELS[feature.type] || feature.type}</p>
                    </div>
                </div>
            </button>

            {isExpanded && (
                <div className="border-t border-white/5 px-3 py-3 space-y-3 max-h-80 overflow-y-auto">
                    <div>
                        <label className="text-[8px] font-bold text-white/70 uppercase block mb-1">Название</label>
                        <div className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-white">
                            {feature.name || 'Без названия'}
                        </div>
                    </div>

                    <div>
                        <label className="text-[8px] font-bold text-white/70 uppercase block mb-1">Описание</label>
                        <div className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-slate-300">
                            {feature.description || 'Нет описания'}
                        </div>
                    </div>

                    {style && (
                        <div>
                            <label className="text-[8px] font-bold text-white/70 uppercase block mb-2">Оформление</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white/[0.03] rounded-lg p-2 border border-white/5">
                                    <span className="text-[7px] text-slate-500 uppercase block mb-1">Контур</span>
                                    <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: style.color || '#666' }} />
                                </div>
                                <div className="bg-white/[0.03] rounded-lg p-2 border border-white/5">
                                    <span className="text-[7px] text-slate-500 uppercase block mb-1">Заливка</span>
                                    <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: style.fillColor || 'transparent' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/[0.03] rounded-lg p-2 border border-white/5">
                            <span className="text-[7px] text-slate-500 uppercase block mb-1">Тип</span>
                            <span className="text-[10px] text-slate-200 font-mono font-bold uppercase">{geomInfo.type}</span>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg p-2 border border-white/5">
                            <span className="text-[7px] text-slate-500 uppercase block mb-1">Вершины</span>
                            <span className="text-[10px] text-slate-200 font-mono font-bold">{geomInfo.coordCount}</span>
                        </div>
                        {areaLabel && (
                            <div className="bg-white/[0.03] rounded-lg p-2 border border-white/5 col-span-2">
                                <span className="text-[7px] text-slate-500 uppercase block mb-1">Площадь</span>
                                <span className="text-[10px] text-slate-200 font-mono font-bold">{areaLabel}</span>
                            </div>
                        )}
                    </div>

                    {schema && schema.fields && schema.fields.length > 0 && (
                        <div>
                            <label className="text-[8px] font-bold text-white/70 uppercase block mb-1">Параметры {schema.label}</label>
                            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-2 space-y-1">
                                {schema.fields.map((field: any) => {
                                    const value = metadata[field.key]
                                    if (value === undefined || value === null || value === '') return null
                                    return (
                                        <div key={field.key} className="flex items-center justify-between gap-2">
                                            <span className="text-[8px] text-slate-500 uppercase truncate">{field.label}</span>
                                            <span className="text-[9px] text-slate-300 truncate max-w-[140px]">
                                                {typeof value === 'boolean' ? (value ? 'Да' : 'Нет') : String(value)}
                                                {field.unit ? ` ${field.unit}` : ''}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-[8px] font-bold text-white/70 uppercase block mb-1">Метаданные</label>
                        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-2 space-y-1">
                            {Object.keys(metadata).length === 0 && <p className="text-[10px] text-slate-500">Пусто</p>}
                            {Object.entries(metadata).map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between gap-2">
                                    <span className="text-[8px] text-slate-500 uppercase truncate">{k}</span>
                                    <span className="text-[9px] text-slate-300 truncate max-w-[140px]">{String(v)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function formatAreaKm2(value: unknown): string | null {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n) || n <= 0) return null

    if (n >= 100) return `${n.toFixed(2)} km2`
    if (n >= 1) return `${n.toFixed(4)} km2`
    return `${n.toFixed(6)} km2`
}
