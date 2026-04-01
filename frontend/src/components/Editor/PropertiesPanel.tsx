/**
 * PropertiesPanel.tsx — Right sidebar for selected feature properties.
 * Floating dark glassmorphism panel.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { getSafeLabel, getSafeStyle } from '../../types/editor'
import type { FeatureClass, ClassStyle } from '../../types/editor'
import { saveAs } from 'file-saver'
import { apiService } from '../../services/api'
import { 
    X, 
    Save, 
    Box, 
    Download, 
    Copy, 
    Trash2, 
    ChevronDown, 
    Type, 
    Layers, 
    Settings2, 
    Activity,
    CheckCircle2,
    ChevronRight
} from 'lucide-react'
import { FEATURE_SCHEMAS } from '../../types/schema'

const FEATURE_CLASSES: FeatureClass[] = ['lake', 'river', 'forest', 'road', 'building', 'city', 'other', 'custom']

export default function PropertiesPanel() {
    const selectedFeatureId = useEditorStore((s) => s.selectedFeatureId)
    const selectedFeatureIds = useEditorStore((s) => s.selectedFeatureIds)
    const features = useEditorStore((s) => s.features)
    const updateFeature = useEditorStore((s) => s.updateFeature)
    const updateFeatureMetadata = useEditorStore((s) => s.updateFeatureMetadata)
    const deleteFeature = useEditorStore((s) => s.deleteFeature)
    const duplicateFeature = useEditorStore((s) => s.duplicateFeature)
    const setSelectedFeature = useEditorStore((s) => s.setSelectedFeature)
    const clearSelection = useEditorStore((s) => s.clearSelection)
    const isGeometryDirty = useEditorStore((s) => s.isGeometryDirty)
    const setGeometryDirty = useEditorStore((s) => s.setGeometryDirty)
    const fetchFeatureHistory = useEditorStore((s) => s.fetchFeatureHistory)

    // Track which features are expanded in multi-select view
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    const toggleExpanded = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Single-select view hooks
    // Don't use useMemo for simple find - it causes dependency issues with array reference changes
    const feature = features.find((f) => f.id === selectedFeatureId) || null

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [style, setStyle] = useState<ClassStyle>({ color: '#000', fillColor: '#000', weight: 2, fillOpacity: 0.3 })
    const [fc, setFc] = useState<FeatureClass>('custom')
    const [isDirty, setIsDirty] = useState(false)
    const [saveFlash, setSaveFlash] = useState(false)
    const savedSnapshot = useRef<any>(null)

    const schema = useMemo(() => {
        if (!feature) return null
        const normalize = (t: string) => {
            const low = t.toLowerCase().trim()
            if (low === 'water' || low === 'reservoir') return 'lake'
            if (low === 'peak') return 'mountain'
            return low
        }
        const specificFclass = feature.metadata?.fclass ? normalize(feature.metadata.fclass.toString()) : null
        if (specificFclass && FEATURE_SCHEMAS[specificFclass]) return FEATURE_SCHEMAS[specificFclass]
        const genericClass = normalize(feature.featureClass)
        return FEATURE_SCHEMAS[genericClass] || FEATURE_SCHEMAS['other']
    }, [feature])

    // All hooks must be defined before early returns
    useEffect(() => {
        if (feature) {
            setName(feature.name)
            setDescription(feature.description || '')
            setStyle(feature.style)
            setFc(feature.featureClass)
            setIsDirty(false)
            savedSnapshot.current = JSON.parse(JSON.stringify(feature))
        }
    }, [feature])

    const markDirty = () => setIsDirty(true)

    const handleSave = async () => {
        if (!feature) return
        const currentFeature = useEditorStore.getState().features.find(f => f.id === feature.id)
        if (!currentFeature) return

        const patch: Partial<typeof feature> = { name, description, style, featureClass: fc }
        updateFeature(feature.id, patch)

        try {
            await apiService.updateGeoObject(feature.backendId || feature.id, {
                name,
                description,
                type: fc as any,
                metadata: { ...feature.metadata, style },
                geometry: currentFeature.geometry
            })

            setIsDirty(false)
            setGeometryDirty(false)
            setSaveFlash(true)
            await fetchFeatureHistory(feature.backendId || feature.id)
            window.dispatchEvent(new Event('refresh-map'))
            setTimeout(() => setSaveFlash(false), 2000)
        } catch (err) {
            console.error('Save failed:', err)
            alert('Ошибка при сохранении')
        }
    }

    const handleClassChange = (newFc: FeatureClass) => {
        const newStyle = { ...getSafeStyle(newFc) }
        setFc(newFc); setStyle(newStyle); markDirty()
    }

    const handleStyleChange = (key: keyof ClassStyle, value: string | number) => {
        setStyle(prev => ({ ...prev, [key]: value })); markDirty()
    }

    const handleDelete = () => {
        if (!feature) return
        if (confirm('Удалить объект?')) {
            if (feature.backendId) apiService.deleteGeoObject(feature.backendId).catch(console.error)
            deleteFeature(feature.id)
        }
    }

    const handleDuplicate = () => { if (feature) duplicateFeature(feature.id) }
    const handleClose = () => setSelectedFeature(null)

    const geomInfo = useMemo(() => {
        if (!feature) return { type: 'Unknown', coordCount: 0 }
        const g = feature.geometry
        let count = 0
        if ('coordinates' in g) count = countCoords(g.coordinates)
        return { type: g.type, coordCount: count }
    }, [feature])

    const exportGeoJSON = () => {
        if (!feature) return
        const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { class: feature.featureClass, name: feature.name }, geometry: feature.geometry }] }
        saveAs(new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' }), `${feature.name}.geojson`)
    }

    // Multi-select view for when multiple objects are selected
    if (selectedFeatureIds.length > 1) {
        const selectedFeatures = features.filter(f => selectedFeatureIds.includes(f.id))
        
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
                    {selectedFeatures.map((f) => (
                        <MultiSelectItem
                            key={f.id}
                            feature={f}
                            isExpanded={expandedIds.has(f.id)}
                            onToggleExpand={() => toggleExpanded(f.id)}
                        />
                    ))}
                </div>
            </div>
        )
    }

    // Empty state view
    if (!feature) return (
        <div className="fixed top-28 right-6 bottom-28 w-[320px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Свойства объекта</h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 rounded-[32px] bg-[#10B981]/5 flex items-center justify-center mb-6 border border-[#10B981]/10">
                    <Box size={32} className="text-[#10B981]/20" />
                </div>
                <p className="text-sm font-bold text-slate-200 mb-2">Объект не выбран</p>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-[180px]">Выберите элемент на карте или в списке слоев, чтобы редактировать его</p>
            </div>
        </div>
    )

    return (
        <div className="fixed top-28 right-6 bottom-28 w-[320px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                    <h2 className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.2em]">Инспектор</h2>
                </div>
                <button onClick={handleClose} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-6 space-y-6">
                {/* Basic Section */}
                <div className="space-y-4">
                    <div className="group">
                        <label className="flex items-center gap-2 text-[9px] font-bold text-white/90 uppercase tracking-widest mb-1.5 ml-1">
                            <Type size={12} className="text-[#10B981]" /> Название
                        </label>
                        <input 
                            className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#10B981]/50 focus:bg-white/[0.05] transition-all"
                            value={name} 
                            onChange={(e) => { setName(e.target.value); markDirty() }} 
                            placeholder="Введите название..."
                        />
                    </div>

                    <div className="group">
                        <label className="flex items-center gap-2 text-[9px] font-bold text-white/90 uppercase tracking-widest mb-1.5 ml-1">
                            <Layers size={12} className="text-[#10B981]" /> Классификация
                        </label>
                        <div className="relative">
                            <select 
                                value={fc} 
                                onChange={(e) => handleClassChange(e.target.value as FeatureClass)}
                                className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none appearance-none cursor-pointer hover:bg-white/[0.05] transition-all"
                            >
                                {FEATURE_CLASSES.map((c: FeatureClass) => (<option key={c} value={c} className="bg-[#0A192F]">{getSafeLabel(c)}</option>))}
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Style Section */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="flex items-center gap-2 text-[9px] font-bold text-white/90 uppercase tracking-widest ml-1">
                        <Settings2 size={12} className="text-[#10B981]" /> Оформление
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:bg-white/[0.05] transition-all">
                            <label className="text-[8px] font-bold text-slate-400 uppercase block mb-2 text-center">Контур</label>
                            <div className="flex items-center justify-center">
                                <input type="color" value={style.color} onChange={(e) => handleStyleChange('color', e.target.value)} className="w-10 h-10 rounded-full cursor-pointer border-2 border-white/20 bg-transparent p-0 overflow-hidden shadow-lg" />
                            </div>
                        </div>
                        <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:bg-white/[0.05] transition-all">
                            <label className="text-[8px] font-bold text-slate-400 uppercase block mb-2 text-center">Заливка</label>
                            <div className="flex items-center justify-center">
                                <input type="color" value={style.fillColor} onChange={(e) => handleStyleChange('fillColor', e.target.value)} className="w-10 h-10 rounded-full cursor-pointer border-2 border-white/20 bg-transparent p-0 overflow-hidden shadow-lg" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 px-1">
                        <div>
                            <div className="flex justify-between items-center mb-2 text-[9px] font-bold text-slate-500 uppercase">
                                <span>Толщина линии</span> <span className="font-mono text-[#10B981]">{style.weight}px</span>
                            </div>
                            <input type="range" min="1" max="10" step="0.5" value={style.weight} onChange={(e) => handleStyleChange('weight', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-[#10B981]" />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2 text-[9px] font-bold text-slate-500 uppercase">
                                <span>Прозрачность заливки</span> <span className="font-mono text-[#10B981]">{Math.round(style.fillOpacity * 100)}%</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.05" value={style.fillOpacity} onChange={(e) => handleStyleChange('fillOpacity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-[#10B981]" />
                        </div>
                    </div>
                </div>

                {/* Metadata Section */}
                {schema && (
                    <div className="pt-4 border-t border-white/5 space-y-4">
                        <label className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                            <Activity size={12} className="text-slate-600" /> Параметры {schema.label}
                        </label>
                        <div className="space-y-3">
                            {schema.fields.map((field) => (
                                <div key={field.key} className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[8px] font-bold text-slate-600 uppercase ml-1">
                                        <field.icon size={10} />
                                        <span>{field.label} {field.unit && `(${field.unit})`}</span>
                                    </div>
                                    
                                    {field.type === 'number' && (
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10B981]/50 font-mono transition-all"
                                                placeholder="0.00"
                                                value={feature.metadata?.[field.key] ?? ''}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value)
                                                    updateFeatureMetadata(feature.id, field.key, val)
                                                    markDirty()
                                                }}
                                            />
                                            {field.unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600 uppercase">{field.unit}</span>}
                                        </div>
                                    )}

                                    {field.type === 'text' && (
                                        <input 
                                            type="text"
                                            className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10B981]/50 transition-all"
                                            value={feature.metadata?.[field.key] || ''}
                                            onChange={(e) => {
                                                updateFeatureMetadata(feature.id, field.key, e.target.value)
                                                markDirty()
                                            }}
                                        />
                                    )}

                                    {field.type === 'select' && (
                                        <div className="relative">
                                            <select 
                                                className="w-full text-xs bg-[#0A192F] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10B981]/50 appearance-none cursor-pointer transition-all"
                                                value={feature.metadata?.[field.key] || ''}
                                                onChange={(e) => {
                                                    updateFeatureMetadata(feature.id, field.key, e.target.value)
                                                    markDirty()
                                                }}
                                            >
                                                <option value="">Не выбрано</option>
                                                {field.options?.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        </div>
                                    )}

                                    {field.type === 'toggle' && (
                                        <button 
                                            onClick={() => {
                                                updateFeatureMetadata(feature.id, field.key, !feature.metadata?.[field.key])
                                                markDirty()
                                            }}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${feature.metadata?.[field.key] ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.03] border-white/10 text-slate-500'}`}
                                        >
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{feature.metadata?.[field.key] ? 'Включено' : 'Отключено'}</span>
                                            <div className={`w-4 h-4 rounded-full transition-all flex items-center justify-center ${feature.metadata?.[field.key] ? 'bg-emerald-500 shadow-[0_0_10px_#10B981]' : 'bg-slate-700'}`}>
                                                {feature.metadata?.[field.key] && <CheckCircle2 size={12} className="text-[#020C1B]" />}
                                            </div>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Info Section */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Информация</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                            <span className="text-[8px] font-bold text-slate-600 uppercase block mb-1">Тип</span>
                            <span className="text-[10px] text-slate-200 font-mono font-bold uppercase tracking-tight">{geomInfo.type}</span>
                        </div>
                        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                            <span className="text-[8px] font-bold text-slate-600 uppercase block mb-1">Вершины</span>
                            <span className="text-[10px] text-slate-200 font-mono font-bold">{geomInfo.coordCount}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 border-t border-white/10 bg-black/20 space-y-3">
                <button 
                    onClick={handleSave} 
                    disabled={!isDirty && !isGeometryDirty}
                    className={`w-full flex items-center justify-center gap-3 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl transition-all duration-300
                        ${saveFlash ? 'bg-emerald-500 text-[#020C1B]' : (isDirty || isGeometryDirty) ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
                >
                    {saveFlash ? <><CheckCircle2 size={16} /> Сохранено</> : <><Save size={16} /> Сохранить</>}
                </button>

                <div className="flex gap-2">
                    <button onClick={handleDuplicate} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[9px] font-bold uppercase tracking-wider bg-white/5 text-slate-400 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                        <Copy size={14} /> Копия
                    </button>
                    <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[9px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all">
                        <Trash2 size={14} /> Удалить
                    </button>
                </div>

                <button onClick={exportGeoJSON} className="w-full flex items-center justify-center gap-2 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-all">
                    <Download size={14} /> Экспорт GeoJSON
                </button>
            </div>
        </div>
    )
}

interface MultiSelectItemProps {
    feature: any
    isExpanded: boolean
    onToggleExpand: () => void
}

function MultiSelectItem({ feature, isExpanded, onToggleExpand }: MultiSelectItemProps) {
    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC
    const updateFeature = useEditorStore((s) => s.updateFeature)
    const deleteFeature = useEditorStore((s) => s.deleteFeature)
    const fetchFeatureHistory = useEditorStore((s) => s.fetchFeatureHistory)

    const [name, setName] = useState(feature?.name || '')
    const [description, setDescription] = useState(feature?.description || '')
    const [fc, setFc] = useState<FeatureClass>(feature?.featureClass || 'custom')
    const [style, setStyle] = useState<ClassStyle>(feature?.style || { color: '#000', fillColor: '#000', weight: 2, fillOpacity: 0.3 })
    const [isDirty, setIsDirty] = useState(false)
    const [saveFlash, setSaveFlash] = useState(false)

    // NOW we can do early return after all hooks
    if (!feature) {
        console.error('[MultiSelectItem] Feature is null/undefined!')
        return null
    }

    const markDirty = () => setIsDirty(true)

    const handleClassChange = (newFc: FeatureClass) => {
        const newStyle = { ...getSafeStyle(newFc) }
        setFc(newFc)
        setStyle(newStyle)
        markDirty()
    }

    const handleStyleChange = (key: keyof ClassStyle, value: string | number) => {
        setStyle(prev => ({ ...prev, [key]: value }))
        markDirty()
    }

    const handleSave = async () => {
        try {
            const patch: Partial<typeof feature> = { name, description, style, featureClass: fc }
            updateFeature(feature.id, patch)

            await apiService.updateGeoObject(feature.backendId || feature.id, {
                name,
                description,
                type: fc as any,
                metadata: { ...feature.metadata, style },
                geometry: feature.geometry
            })

            setIsDirty(false)
            setSaveFlash(true)
            await fetchFeatureHistory(feature.backendId || feature.id)
            window.dispatchEvent(new Event('refresh-map'))
            setTimeout(() => setSaveFlash(false), 2000)
        } catch (err) {
            console.error('Save failed:', err)
        }
    }

    const handleDelete = () => {
        if (confirm('Удалить объект?')) {
            if (feature.backendId) apiService.deleteGeoObject(feature.backendId).catch(console.error)
            deleteFeature(feature.id)
        }
    }

    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
            <button
                onClick={() => {
                    
                    onToggleExpand()
                }}
                className="w-full flex items-center justify-between p-3 hover:bg-white/[0.08] transition-all"
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronRight 
                        size={14} 
                        className={`text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-white truncate">{name || 'Без названия'}</p>
                        <p className="text-[8px] text-slate-500">{fc}</p>
                    </div>
                </div>
            </button>

            {isExpanded && (
                <div className="border-t border-white/5 px-3 py-3 space-y-3 max-h-80 overflow-y-auto">
                    <div>
                        <label className="flex items-center gap-1.5 text-[8px] font-bold text-white/70 uppercase mb-1">
                            <Type size={10} /> Название
                        </label>
                        <input 
                            className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-[#10B981]/50"
                            value={name} 
                            onChange={(e) => { setName(e.target.value); markDirty() }}
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-1.5 text-[8px] font-bold text-white/70 uppercase mb-1">
                            <Type size={10} /> Описание
                        </label>
                        <textarea 
                            className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-[#10B981]/50 resize-none"
                            rows={2}
                            value={description} 
                            onChange={(e) => { setDescription(e.target.value); markDirty() }}
                            placeholder="Введите описание..."
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-1.5 text-[8px] font-bold text-white/70 uppercase mb-1">
                            <Layers size={10} /> Вип
                        </label>
                        <select 
                            value={fc} 
                            onChange={(e) => handleClassChange(e.target.value as FeatureClass)}
                            className="w-full text-xs bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-white appearance-none cursor-pointer"
                        >
                            {FEATURE_CLASSES.map((c) => (<option key={c} value={c} className="bg-[#0A192F]">{getSafeLabel(c)}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[8px] font-bold text-white/70 uppercase block mb-2">Оформление</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[7px] text-slate-500 block mb-1">Контур</label>
                                <input type="color" value={style.color} onChange={(e) => handleStyleChange('color', e.target.value)} className="w-full h-6 rounded border border-white/20 cursor-pointer" />
                            </div>
                            <div>
                                <label className="text-[7px] text-slate-500 block mb-1">Заливка</label>
                                <input type="color" value={style.fillColor} onChange={(e) => handleStyleChange('fillColor', e.target.value)} className="w-full h-6 rounded border border-white/20 cursor-pointer" />
                            </div>
                            <div>
                                <label className="text-[7px] text-slate-500 block mb-1">Толщина</label>
                                <input type="number" min="0.5" max="10" step="0.5" value={style.weight} onChange={(e) => handleStyleChange('weight', parseFloat(e.target.value))} className="w-full text-xs bg-white/[0.03] border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-[#10B981]/50" />
                            </div>
                            <div>
                                <label className="text-[7px] text-slate-500 block mb-1">Прозрачность</label>
                                <input type="number" min="0" max="1" step="0.1" value={style.fillOpacity} onChange={(e) => handleStyleChange('fillOpacity', parseFloat(e.target.value))} className="w-full text-xs bg-white/[0.03] border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-[#10B981]/50" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={handleSave}
                            disabled={!isDirty}
                            className={`flex-1 px-2 py-1.5 text-[7px] font-bold rounded transition-all ${
                                saveFlash ? 'bg-emerald-500 text-black' : isDirty ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white/5 text-slate-600'
                            }`}
                        >
                            {saveFlash ? '✓' : 'Сохр'}
                        </button>
                        <button onClick={handleDelete} className="flex-1 px-2 py-1.5 text-[7px] font-bold rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
                            Удал
                        </button>
                    </div>
                </div>
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
