import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { getSafeStyle, getSafeLabel } from '../../types/editor'
import type { EditHistoryEntry, EditorFeature } from '../../types/editor'
import { Download, Layers, Clock } from 'lucide-react'

const ACTION_LABELS: Record<EditHistoryEntry['action'], { label: string; color: string }> = {
    create: { label: 'Создание', color: 'bg-green-500' },
    update: { label: 'Изменение', color: 'bg-blue-500' },
    delete: { label: 'Удаление', color: 'bg-red-500' },
}

export default function LayersPanel() {
    const {
        layers,
        features,
        selectedFeatureId,
        currentTool,
        serverHistory,
        setSelectedFeature,
        toggleLayerExpand,
        toggleFeatureVisibility,
        toggleFeatureLock,
        silentUpdateFeature,
        fetchFeatureHistory,
        rollbackToHistory,
        mapOpacity,
        setMapOpacity,
    } = useEditorStore()

    const [activeTab, setActiveTab] = useState<'layers' | 'history'>('layers')
    const [rollbackPopup, setRollbackPopup] = useState<any | null>(null)
    const previewRestore = useRef<EditorFeature | null>(null)

    // Auto-switch to history tab when history tool is active
    useEffect(() => {
        if (currentTool === 'history') setActiveTab('history')
    }, [currentTool])

    // Fetch history when selected feature changes (only on selection change, not on every feature update)
    useEffect(() => {
        if (selectedFeatureId) {
            const state = useEditorStore.getState()
            const feat = state.features.find(f => f.id === selectedFeatureId)
            const backendId = feat?.backendId || selectedFeatureId
            fetchFeatureHistory(backendId)
        }
    }, [selectedFeatureId])

    // ─── Hover preview: show old state on map ─────────────────
    const handleEntryHover = useCallback((entry: any) => {
        const snap = entry.afterSnapshot
        if (!snap || !selectedFeatureId) return
        
        const store = useEditorStore.getState()
        const current = store.features.find(f => f.id === selectedFeatureId)
        if (!current) return

        previewRestore.current = { ...current }
        
        // Apply historical state visually
        const patch: Partial<EditorFeature> = { 
            visible: true,
            name: snap.name || current.name,
            geometry: snap.geometry || current.geometry,
            featureClass: snap.type || current.featureClass
        }
        silentUpdateFeature(selectedFeatureId, patch)
    }, [selectedFeatureId, silentUpdateFeature])

    const handleEntryLeave = useCallback(() => {
        if (!previewRestore.current || !selectedFeatureId) return
        const f = previewRestore.current
        silentUpdateFeature(selectedFeatureId, {
            name: f.name,
            featureClass: f.featureClass,
            geometry: f.geometry,
            visible: f.visible
        })
        previewRestore.current = null
    }, [selectedFeatureId, silentUpdateFeature])

    // ─── Rollback confirm ─────────────────────────────────────
    const handleRollback = useCallback((entry: any) => {
        handleEntryLeave()
        setRollbackPopup(entry)
    }, [handleEntryLeave])

    const confirmRollback = useCallback(async () => {
        if (!rollbackPopup) return
        try {
            await rollbackToHistory(rollbackPopup.id)
            if (selectedFeatureId) {
                const state = useEditorStore.getState()
                const feat = state.features.find(f => f.id === selectedFeatureId)
                const backendId = feat?.backendId || selectedFeatureId
                fetchFeatureHistory(backendId)
            }
            setRollbackPopup(null)
            // Note: In a real app, you'd trigger a map refresh here
            window.location.reload()
        } catch (err) {
            alert('Ошибка при откате изменений')
        }
    }, [rollbackPopup, selectedFeatureId, rollbackToHistory, fetchFeatureHistory])

    return (
        <div className="fixed top-24 left-6 bottom-32 w-[300px] bg-[#020C1B] border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-[30px]">
            {/* Tabs */}
            <div className="flex bg-[#0A192F] text-white p-2 border-b border-white/5">
                <button
                    onClick={() => setActiveTab('layers')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all duration-300 ${activeTab === 'layers' ? 'bg-[#10B981] text-[#020C1B]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    <Layers size={14} /> Слои
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all duration-300 ${activeTab === 'history' ? 'bg-[#0077FF] text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    <Clock size={14} /> История
                </button>
            </div>

            {activeTab === 'layers' ? (
                <>
                    {/* Map Opacity Control */}
                    <div className="px-6 py-5 border-b border-white/5 bg-white/2">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Прозрачность карты</span>
                            <span className="text-[10px] font-bold text-[#10B981]">{Math.round(mapOpacity * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={mapOpacity} onChange={(e) => setMapOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#10B981]" />
                    </div>

                    <div className="flex-1 overflow-y-auto py-4 px-2 custom-scrollbar">
                        {layers.map((layer) => {
                            const layerFeatures = features.filter(f => f.featureClass === layer.featureClass)
                            return (
                                <div key={layer.id} className="mb-1">
                                    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer hover:bg-white/5 transition-all ${!layer.visible ? 'opacity-30' : ''}`} onClick={() => toggleLayerExpand(layer.id)}>
                                        <span className={`transition-transform duration-300 ${layer.expanded ? 'rotate-90' : ''}`}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="9 18 15 12 9 6" /></svg></span>
                                        <span className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: getSafeStyle(layer.featureClass).fillColor }} />
                                        <span className="flex-1 text-[11px] font-black text-white truncate uppercase tracking-wider">{getSafeLabel(layer.featureClass)}</span>
                                        <span className="text-[9px] text-slate-500 font-black bg-white/5 px-2.5 py-0.5 rounded-full">{layerFeatures.length}</span>
                                    </div>
                                    {layer.expanded && (
                                        <div className="mt-1 space-y-0.5">
                                            {[...layerFeatures].reverse().map((feature) => (
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
                </>
            ) : (
                /* HISTORY TAB */
                <div className="flex-1 overflow-y-auto p-6 relative bg-transparent custom-scrollbar">
                    {!selectedFeatureId ? (
                        <div className="text-center py-24 px-4">
                            <Clock size={32} className="mx-auto text-slate-700 mb-4 opacity-30" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Объект не выбран</p>
                        </div>
                    ) : serverHistory.length > 0 ? (
                        <div className="relative pl-6">
                            <div className="absolute left-[8px] top-2 bottom-2 w-0.5 bg-white/5" />
                            <div className="space-y-8">
                                {[...serverHistory]
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((entry, idx) => {
                                    const actionInfo = ACTION_LABELS[entry.action] || { label: entry.action, color: 'bg-slate-600' }
                                    const isLatest = idx === 0
                                    return (
                                        <div
                                            key={entry.id}
                                            className="relative group cursor-pointer"
                                            onMouseEnter={() => handleEntryHover(entry)}
                                            onMouseLeave={handleEntryLeave}
                                            onClick={() => handleRollback(entry)}
                                        >
                                            <div className={`absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full border-2 z-10 transition-all ${isLatest ? 'bg-[#10B981] border-white scale-125 shadow-[0_0_10px_#10B981]' : 'bg-slate-800 border-slate-600'}`} />

                                            <div className={`p-4 rounded-2xl border transition-all duration-300 ${isLatest ? 'bg-white/10 border-[#10B981]/30 shadow-lg shadow-[#10B981]/5' : 'bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/10'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`text-[8px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-widest ${actionInfo.color}`}>
                                                        {actionInfo.label}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 font-bold">{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-xs font-bold text-white leading-tight mb-2">{entry.description}</p>
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                                    <span className="text-[8px] text-[#10B981] uppercase font-black tracking-[0.2em]">{isLatest ? 'Текущая версия' : 'Предыдущая'}</span>
                                                    {!isLatest && (
                                                        <div className="text-[#10B981] opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-24">
                            <Clock size={32} className="mx-auto text-slate-700 mb-4 opacity-30" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">История пуста</p>
                        </div>
                    )}
                </div>
            )}

            <div className="px-6 py-4 border-t border-white/5 bg-white/5">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{features.length} объектов</span>
                    <button className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-[#10B981] transition-colors border border-white/5"><Download size={16} /></button>
                </div>
            </div>

            {/* ─── Rollback Confirmation Popup ─────────────────── */}
            {rollbackPopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#0A192F] rounded-[24px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] p-6 max-w-sm mx-4 border border-white/[0.08]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                <Clock size={20} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Откатить изменения?</h3>
                                <p className="text-xs text-slate-500">Версия от {rollbackPopup.formattedDate}</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mb-5 bg-white/5 rounded-xl p-3 border border-white/5 leading-relaxed">
                            Объект <strong className="text-white">"{rollbackPopup.featureName}"</strong> будет возвращён к предыдущему состоянию. Текущие изменения будут записаны в историю.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setRollbackPopup(null)}
                                className="flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-colors border border-white/5"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={confirmRollback}
                                className="flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-[#020C1B] rounded-xl transition-colors shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                            >
                                Откатить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function FeatureItem({ feature, isSelected, onSelect, onToggleVisibility, onToggleLock }: any) {
    const updateFeature = useEditorStore((s) => s.updateFeature)
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(feature.name)

    // Geometry type icon
    const geoType = feature.geometry?.type || ''
    let geoIcon = '◆'
    if (geoType.includes('Polygon')) geoIcon = '⬠'
    else if (geoType.includes('Line')) geoIcon = '╱'
    else if (geoType.includes('Point')) geoIcon = '●'

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-[#10B981]/10 border border-[#10B981]/20' : 'hover:bg-white/5 border border-transparent'}`} onClick={onSelect}>
            <span className="text-[10px] text-slate-600" title={geoType}>{geoIcon}</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getSafeStyle(feature.featureClass).fillColor }} />
            {editing ? (
                <input className="flex-1 text-[11px] bg-white/10 border border-[#10B981]/30 rounded-lg px-1.5 py-0.5 text-white outline-none" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { updateFeature(feature.id, { name }); setEditing(false) }} autoFocus />
            ) : (
                <span className="flex-1 text-[11px] text-slate-300 truncate" onDoubleClick={() => setEditing(true)}>{feature.name}</span>
            )}
            <button onClick={(e) => { e.stopPropagation(); onToggleVisibility() }} className="text-slate-600 hover:text-slate-300 transition-colors" title={feature.visible ? 'Скрыть' : 'Показать'}>
                {feature.visible ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                )}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onToggleLock() }} className="text-slate-600 hover:text-slate-300 transition-colors" title={feature.locked ? 'Разблокировать' : 'Заблокировать'}>
                {feature.locked ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 019.9-1" /></svg>
                )}
            </button>
        </div>
    )
}
