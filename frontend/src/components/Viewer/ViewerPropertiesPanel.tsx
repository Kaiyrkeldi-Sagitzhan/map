/**
 * ViewerPropertiesPanel.tsx — Right sidebar for the viewer.
 * Same floating glassmorphic style as editor's PropertiesPanel.
 * Displays feature properties read-only (no inputs, no save/delete).
 */
import { useMemo, useState } from 'react'
import { useViewerStore } from '../../store/viewerStore'
import { X, Box, Type, Layers, Settings2, Activity, ChevronRight } from 'lucide-react'
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
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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

    if (selectedFeatureIds.length > 1) {
        return (
            <div className="fixed top-28 right-6 bottom-28 w-[320px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px]">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                        <h2 className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.2em]">Выбрано: {selectedFeatureIds.length}</h2>
                    </div>
                    <button onClick={clearSelection} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={16} /></button>
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

    if (!selectedFeature) return (
        <div className="fixed top-28 right-6 bottom-28 w-[320px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Свойства объекта</h2>
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

    const metadata = selectedFeature.metadata || {}
    const style = selectedFeature.style

    return (
        <div className="fixed top-28 right-6 bottom-28 w-[320px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                    <h2 className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.2em]">Инспектор</h2>
                </div>
                <button onClick={clearSelection} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-6 space-y-6">
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
            </div>
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
