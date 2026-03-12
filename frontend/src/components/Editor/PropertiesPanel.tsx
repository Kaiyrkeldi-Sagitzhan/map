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
import { X, Save, Box, Download } from 'lucide-react'
import { FEATURE_SCHEMAS } from '../../types/schema'

const featureClasses: FeatureClass[] = ['lake', 'river', 'forest', 'road', 'building', 'city', 'other', 'custom']

export default function PropertiesPanel() {
    const selectedFeatureId = useEditorStore((s) => s.selectedFeatureId)
    const features = useEditorStore((s) => s.features)
    const updateFeature = useEditorStore((s) => s.updateFeature)
    const updateFeatureMetadata = useEditorStore((s) => s.updateFeatureMetadata)
    const deleteFeature = useEditorStore((s) => s.deleteFeature)
    const duplicateFeature = useEditorStore((s) => s.duplicateFeature)
    const setSelectedFeature = useEditorStore((s) => s.setSelectedFeature)
    const isGeometryDirty = useEditorStore((s) => s.isGeometryDirty)
    const setGeometryDirty = useEditorStore((s) => s.setGeometryDirty)
    const fetchFeatureHistory = useEditorStore((s) => s.fetchFeatureHistory)

    const feature = useMemo(() => features.find((f) => f.id === selectedFeatureId), [features, selectedFeatureId])

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [style, setStyle] = useState<ClassStyle>({ color: '#000', fillColor: '#000', weight: 2, fillOpacity: 0.3 })
    const [fc, setFc] = useState<FeatureClass>('custom')
    const [isDirty, setIsDirty] = useState(false)
    const [saveFlash, setSaveFlash] = useState(false)
    const savedSnapshot = useRef<any>(null)

    // Dynamic schema for the selected feature
    const schema = useMemo(() => {
        if (!feature) return null
        
        // Normalize fclass/type for schema lookup
        const normalize = (t: string) => {
            const low = t.toLowerCase().trim()
            if (low === 'water' || low === 'reservoir') return 'lake'
            if (low === 'peak') return 'mountain'
            return low
        }

        // 1. Try metadata.fclass (specific OSM type)
        const specificFclass = feature.metadata?.fclass ? normalize(feature.metadata.fclass.toString()) : null
        if (specificFclass && FEATURE_SCHEMAS[specificFclass]) {
            return FEATURE_SCHEMAS[specificFclass]
        }
        
        // 2. Try normalized featureClass
        const genericClass = normalize(feature.featureClass)
        return FEATURE_SCHEMAS[genericClass] || FEATURE_SCHEMAS['other']
    }, [feature?.featureClass, feature?.metadata])

    useEffect(() => {
        if (feature) {
            setName(feature.name)
            setDescription(feature.description || '')
            setStyle(feature.style)
            setFc(feature.featureClass)
            setIsDirty(false)
            savedSnapshot.current = JSON.parse(JSON.stringify(feature))
        }
    }, [feature?.id])

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
            
            // CRITICAL: Refresh history immediately
            await fetchFeatureHistory(feature.backendId || feature.id)

            // Trigger map visual refresh
            window.dispatchEvent(new Event('refresh-map'))

            setTimeout(() => setSaveFlash(false), 1500)
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

    if (!feature) return (
        <div className="fixed top-24 right-6 bottom-32 w-[320px] bg-[#020C1B] border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-[30px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                <h2 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Свойства объекта</h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                <div className="w-20 h-20 rounded-[30px] bg-[#10B981]/5 flex items-center justify-center mb-6 border border-[#10B981]/10">
                    <Box size={32} className="text-[#10B981]/40" />
                </div>
                <p className="text-sm font-bold text-white mb-2">Объект не выбран</p>
                <p className="text-[11px] text-slate-500 italic leading-relaxed">Нажмите на элемент на карте, чтобы увидеть его параметры</p>
            </div>
        </div>
    )

    return (
        <div className="fixed top-24 right-6 bottom-32 w-[320px] bg-[#020C1B] border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-[30px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                <h2 className="text-[9px] font-black text-[#10B981] uppercase tracking-[0.2em]">Параметры объекта</h2>
                <button onClick={handleClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"><X size={14} strokeWidth={3} /></button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar px-2">
                <div className="px-4 py-5 border-b border-white/5">
                    <label className="text-[9px] font-black text-slate-500 mb-2 block uppercase tracking-widest ml-2">Название</label>
                    <input className="w-full text-sm bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10B981] transition-all"
                        value={name} onChange={(e) => { setName(e.target.value); markDirty() }} />
                </div>

                <div className="px-4 py-5 border-b border-white/5">
                    <label className="text-[9px] font-black text-slate-500 mb-2 block uppercase tracking-widest ml-2">Классификация</label>
                    <select value={fc} onChange={(e) => handleClassChange(e.target.value as FeatureClass)}
                        className="w-full text-sm bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white focus:outline-none appearance-none cursor-pointer">
                        {featureClasses.map((c) => (<option key={c} value={c} className="bg-[#0A192F]">{getSafeLabel(c)}</option>))}
                    </select>
                </div>

                <div className="px-4 py-5 border-b border-white/5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                            <label className="text-[8px] font-bold text-slate-500 uppercase block mb-2 text-center">Контур</label>
                            <input type="color" value={style.color} onChange={(e) => handleStyleChange('color', e.target.value)} className="w-full h-8 rounded-lg cursor-pointer border-none bg-transparent" />
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                            <label className="text-[8px] font-bold text-slate-500 uppercase block mb-2 text-center">Заливка</label>
                            <input type="color" value={style.fillColor} onChange={(e) => handleStyleChange('fillColor', e.target.value)} className="w-full h-8 rounded-lg cursor-pointer border-none bg-transparent" />
                        </div>
                    </div>
                </div>

                <div className="px-4 py-5 border-b border-white/5 space-y-5 px-4">
                    <div>
                        <div className="flex justify-between items-center mb-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            <span>Толщина линии</span> <span className="text-[#10B981]">{style.weight}px</span>
                        </div>
                        <input type="range" min="1" max="10" step="0.5" value={style.weight} onChange={(e) => handleStyleChange('weight', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-[#10B981]" />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            <span>Прозрачность</span> <span className="text-[#10B981]">{Math.round(style.fillOpacity * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.05" value={style.fillOpacity} onChange={(e) => handleStyleChange('fillOpacity', parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-[#10B981]" />
                    </div>
                </div>

                {/* ─── Dynamic Parameters (Metadata) ─────────────────── */}
                {schema && (
                    <div className="px-4 py-5 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2 mb-4 ml-2">
                            <schema.icon size={14} className="text-[#10B981]" />
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                Доп. параметры ({schema.label})
                            </label>
                        </div>
                        
                        <div className="space-y-4">
                            {schema.fields.map((field) => (
                                <div key={field.key} className="space-y-1.5 px-1">
                                    <div className="flex items-center gap-2 text-[8px] font-bold text-slate-500 uppercase tracking-tighter ml-1">
                                        <field.icon size={10} />
                                        <span>{field.label} {field.unit && `(${field.unit})`}</span>
                                    </div>
                                    
                                    {field.type === 'number' && (
                                        <div className="relative flex items-center">
                                            <input 
                                                type="number"
                                                className="w-full text-xs bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-white focus:outline-none focus:border-[#10B981] transition-all font-mono"
                                                placeholder="0.00"
                                                value={feature.metadata?.[field.key] ?? ''}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value)
                                                    updateFeatureMetadata(feature.id, field.key, val)
                                                    markDirty()
                                                }}
                                            />
                                            {field.unit && <span className="absolute right-4 text-[9px] font-bold text-slate-500 uppercase">{field.unit}</span>}
                                        </div>
                                    )}

                                    {field.type === 'text' && (
                                        <input 
                                            type="text"
                                            className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#10B981] transition-all"
                                            value={feature.metadata?.[field.key] || ''}
                                            onChange={(e) => {
                                                updateFeatureMetadata(feature.id, field.key, e.target.value)
                                                markDirty()
                                            }}
                                        />
                                    )}

                                    {field.type === 'select' && (
                                        <select 
                                            className="w-full text-xs bg-[#0A192F] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#10B981] transition-all appearance-none cursor-pointer"
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
                                    )}

                                    {field.type === 'toggle' && (
                                        <button 
                                            onClick={() => {
                                                updateFeatureMetadata(feature.id, field.key, !feature.metadata?.[field.key])
                                                markDirty()
                                            }}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${feature.metadata?.[field.key] ? 'bg-[#10B981]/20 border-[#10B981]/40 text-[#10B981]' : 'bg-white/5 border-white/10 text-slate-500'}`}
                                        >
                                            <div className={`w-3 h-3 rounded-full transition-all ${feature.metadata?.[field.key] ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 'bg-slate-600'}`} />
                                            <span className="text-[10px] font-bold uppercase">{feature.metadata?.[field.key] ? 'Вкл' : 'Выкл'}</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="px-4 py-5">
                    <button onClick={handleSave} disabled={!isDirty && !isGeometryDirty}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-500
                            ${saveFlash ? 'bg-[#10B981] text-[#020C1B]' : (isDirty || isGeometryDirty) ? 'bg-[#0077FF] text-white shadow-[0_0_25px_rgba(0,119,255,0.4)]' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}>
                        {saveFlash ? <><Save size={16} strokeWidth={3} /> Сохранено</> : <><Save size={16} strokeWidth={2} /> Сохранить изменения</>}
                    </button>
                </div>

                <div className="px-4 py-2 flex items-center gap-3">
                    <button onClick={handleDuplicate} className="flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-widest bg-white/5 text-slate-300 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">Копия</button>
                    <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 hover:bg-red-500/20 transition-all">Удалить</button>
                </div>

                <div className="px-4 py-5 border-t border-white/5 mt-4">
                    <label className="text-[9px] font-black text-slate-500 mb-3 block uppercase tracking-widest ml-2">Технические данные</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                            <span className="text-[8px] font-bold text-slate-500 uppercase block mb-1 text-center">Геометрия</span>
                            <span className="text-[10px] text-white font-bold block text-center uppercase tracking-tighter">{geomInfo.type}</span>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                            <span className="text-[8px] font-bold text-slate-500 uppercase block mb-1 text-center">Вершины</span>
                            <span className="text-[10px] text-white font-bold block text-center">{geomInfo.coordCount}</span>
                        </div>
                    </div>
                </div>

                <div className="px-4 py-6 mb-10">
                    <button onClick={exportGeoJSON} className="w-full flex items-center justify-center gap-2 py-3 bg-[#10B981]/10 text-[#10B981] rounded-2xl border border-[#10B981]/20 hover:bg-[#10B981]/20 transition-all">
                        <Download size={16} /> <span className="text-[9px] font-black uppercase tracking-widest">Экспорт GeoJSON</span>
                    </button>
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
