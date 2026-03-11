import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { getSafeStyle, getSafeLabel } from '../../types/editor'
import type { EditHistoryEntry, EditorFeature } from '../../types/editor'
import { Download, Layers, Clock } from 'lucide-react'
import { apiService } from '../../services/api'

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
        editHistory,
        setSelectedFeature,
        toggleLayerExpand,
        toggleFeatureVisibility,
        toggleFeatureLock,
        silentUpdateFeature,
        deleteEditHistoryEntry,
        mapOpacity,
        setMapOpacity,
    } = useEditorStore()

    const [activeTab, setActiveTab] = useState<'layers' | 'history'>('layers')
    const [rollbackPopup, setRollbackPopup] = useState<EditHistoryEntry | null>(null)
    // Store snapshot of current feature before preview so we can restore
    const previewRestore = useRef<EditorFeature | null>(null)

    // Auto-switch to history tab when history tool is active
    useEffect(() => {
        if (currentTool === 'history') setActiveTab('history')
    }, [currentTool])

    // Only show history for the selected feature
    const displayHistory = selectedFeatureId
        ? editHistory.filter((e) => e.featureId === selectedFeatureId)
        : []

    // ─── Hover preview: show old state on map ─────────────────
    const handleEntryHover = useCallback((entry: EditHistoryEntry) => {
        const store = useEditorStore.getState()
        const current = store.features.find(f => f.id === entry.featureId)
        
        // If rolling back creation -> object didn't exist (hide it)
        if (entry.action === 'create') {
            if (!current) return
            previewRestore.current = { ...current }
            silentUpdateFeature(entry.featureId, { visible: false })
            return
        }

        // If rolling back update or delete
        if (!entry.beforeSnapshot) return
        const snap = entry.beforeSnapshot as Partial<EditorFeature>
        
        if (entry.action === 'delete') {
            // Deleted objects are hard to hover preview without adding them back
            return 
        }

        if (!current) return
        previewRestore.current = { ...current }
        // Apply old state visually
        const patch: Partial<EditorFeature> = { visible: true }
        if (snap.style) patch.style = snap.style
        if (snap.name) patch.name = snap.name
        if (snap.featureClass) patch.featureClass = snap.featureClass
        if (snap.geometry) patch.geometry = snap.geometry
        silentUpdateFeature(entry.featureId, patch)
    }, [silentUpdateFeature])

    const handleEntryLeave = useCallback(() => {
        if (!previewRestore.current) return
        const f = previewRestore.current
        silentUpdateFeature(f.id, {
            style: f.style,
            name: f.name,
            featureClass: f.featureClass,
            geometry: f.geometry,
            visible: f.visible
        })
        previewRestore.current = null
    }, [silentUpdateFeature])

    // ─── Rollback confirm ─────────────────────────────────────
    const handleRollback = useCallback((entry: EditHistoryEntry) => {
        // Allow rollback for create (delete the object) and for updates/deletes with beforeSnapshot
        if (entry.action !== 'create' && !entry.beforeSnapshot) return
        // Restore from hover first
        handleEntryLeave()
        setRollbackPopup(entry)
    }, [handleEntryLeave])

    const confirmRollback = useCallback(async () => {
        if (!rollbackPopup) return
        const store = useEditorStore.getState()
        const fid = rollbackPopup.featureId
        
        // ─── CASE 1: Rollback Creation (Delete the object) ───
        if (rollbackPopup.action === 'create') {
            const current = store.features.find(f => f.id === fid)
            if (current?.backendId) {
                await apiService.deleteGeoObject(current.backendId).catch(console.error)
            }
            store.deleteFeature(fid)
            setRollbackPopup(null)
            return
        }

        // ─── CASE 2: Rollback Deletion (Restore the object) ───
        if (rollbackPopup.action === 'delete') {
            const snap = rollbackPopup.beforeSnapshot as EditorFeature
            if (snap) {
                const res = await apiService.createGeoObject({
                    scope: snap.metadata?.scope || 'private',
                    type: snap.featureClass as any,
                    name: snap.name,
                    description: snap.description,
                    geometry: snap.geometry as any,
                    metadata: { ...snap.metadata, style: snap.style }
                })
                store.addFeature({ ...snap, backendId: (res as any).id })
            }
            setRollbackPopup(null)
            return
        }

        // ─── CASE 3: Rollback Update (Restore previous properties) ───
        const snap = rollbackPopup.beforeSnapshot as Partial<EditorFeature>
        const current = store.features.find(f => f.id === fid)
        if (!current || !snap) { setRollbackPopup(null); return }

        const patch: Partial<EditorFeature> = {}
        if (snap.style) patch.style = snap.style
        if (snap.name) patch.name = snap.name
        if (snap.featureClass) patch.featureClass = snap.featureClass
        if (snap.description !== undefined) patch.description = snap.description
        if (snap.geometry) patch.geometry = snap.geometry

        if (current.backendId) {
            try {
                await apiService.updateGeoObject(current.backendId, {
                    name: patch.name || current.name,
                    description: patch.description || current.description,
                    type: (patch.featureClass || current.featureClass) as any,
                    geometry: patch.geometry || current.geometry,
                    metadata: { ...current.metadata, style: patch.style || current.style }
                })
            } catch (err) { console.error('Rollback sync failed', err) }
        }

        store.updateFeature(fid, patch)
        store.addEditHistoryEntry({
            id: crypto.randomUUID(),
            featureId: fid,
            featureName: snap.name || current.name,
            action: 'update',
            timestamp: Date.now(),
            formattedDate: new Date().toLocaleString('ru-RU'),
            user: 'user',
            description: `Откат к версии от ${rollbackPopup.formattedDate}`,
            beforeSnapshot: JSON.parse(JSON.stringify(current)),
            afterSnapshot: { ...current, ...patch },
        })

        setRollbackPopup(null)
    }, [rollbackPopup])

    return (
        <div className="w-[280px] min-w-[280px] h-full bg-white/80 backdrop-blur-md border-r border-gray-200/50 flex flex-col z-[500] overflow-hidden shadow-xl">
            {/* Tabs */}
            <div className="flex bg-slate-900 text-white p-1">
                <button
                    onClick={() => setActiveTab('layers')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${activeTab === 'layers' ? 'bg-indigo-600' : 'text-slate-400 hover:text-white'}`}
                >
                    <Layers size={14} /> Слои
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition ${activeTab === 'history' ? 'bg-amber-500' : 'text-slate-400 hover:text-white'}`}
                >
                    <Clock size={14} /> История
                </button>
            </div>

            {activeTab === 'layers' ? (
                <>
                    {/* Map Opacity Control */}
                    <div className="px-4 py-3 border-b border-gray-100/50 bg-gray-50/30">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Прозрачность</span>
                            <span className="text-[10px] font-bold text-indigo-600">{Math.round(mapOpacity * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={mapOpacity} onChange={(e) => setMapOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>

                    <div className="flex-1 overflow-y-auto py-2">
                        {layers.map((layer) => {
                            const layerFeatures = features.filter(f => f.featureClass === layer.featureClass)
                            return (
                                <div key={layer.id} className="mb-0.5">
                                    <div className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer hover:bg-gray-50 ${!layer.visible ? 'opacity-50' : ''}`} onClick={() => toggleLayerExpand(layer.id)}>
                                        <span className={`transition-transform ${layer.expanded ? 'rotate-90' : ''}`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg></span>
                                        <span className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: getSafeStyle(layer.featureClass).fillColor }} />
                                        <span className="flex-1 text-xs font-bold text-gray-800 truncate">{getSafeLabel(layer.featureClass)}</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{layerFeatures.length}</span>
                                    </div>
                                    {layer.expanded && (
                                        <div className="ml-5">
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
                <div className="flex-1 overflow-y-auto p-4 relative bg-slate-50/50">
                    {!selectedFeatureId ? (
                        <div className="text-center py-20">
                            <Clock size={32} className="mx-auto text-slate-300 mb-4 opacity-50" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Объект не выбран
                            </p>
                            <p className="text-[10px] text-slate-300 mt-1">Выберите объект, чтобы увидеть его историю</p>
                        </div>
                    ) : displayHistory.length > 0 ? (
                        <div className="relative pl-7">
                            {/* Timeline "Road" line */}
                            <div className="absolute left-[10px] top-0 bottom-0 w-1.5 bg-slate-300 rounded-full" />

                            <div className="space-y-6">
                                {displayHistory.slice().reverse().map((entry) => {
                                    const actionInfo = ACTION_LABELS[entry.action]
                                    const canRollback = true
                                    return (
                                        <div
                                            key={entry.id}
                                            className="relative group cursor-pointer"
                                            onMouseEnter={() => handleEntryHover(entry)}
                                            onMouseLeave={handleEntryLeave}
                                            onClick={() => handleRollback(entry)}
                                        >
                                            {/* Blue point on the road */}
                                            <div className="absolute -left-[24px] top-4 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-md z-10 transition-transform group-hover:scale-125" />

                                            <div className={`bg-white p-4 rounded-2xl border-2 shadow-sm transition-all duration-300 ${canRollback ? 'border-transparent hover:border-blue-400 hover:shadow-blue-100' : 'border-transparent shadow-slate-200/50'}`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`text-[9px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-tighter ${actionInfo.color}`}>
                                                        {actionInfo.label}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{entry.formattedDate}</span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 leading-tight mb-2">{entry.description}</p>
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{entry.featureName}</span>
                                                        <span className="text-[9px] text-blue-500 font-medium">@{entry.user}</span>
                                                    </div>
                                                    {canRollback && (
                                                        <div className="flex items-center gap-1 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-[10px] font-black uppercase">Откат</span>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const isLatest = displayHistory[displayHistory.length - 1]?.id === entry.id;
                                                            if (isLatest) {
                                                                if (confirm('Удалить это изменение и ВЕРНУТЬ объект к предыдущему состоянию?')) {
                                                                    handleRollback(entry);
                                                                    deleteEditHistoryEntry(entry.id);
                                                                }
                                                            } else {
                                                                if (confirm('Удалить эту запись из истории?')) {
                                                                    deleteEditHistoryEntry(entry.id);
                                                                }
                                                            }
                                                        }}
                                                        className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Удалить из истории"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <Clock size={32} className="mx-auto text-slate-300 mb-4 opacity-50" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Нет записей
                            </p>
                            <p className="text-[10px] text-slate-300 mt-1">Начните редактирование</p>
                        </div>
                    )}
                </div>
            )}

            <div className="px-4 py-3 border-t border-gray-100 bg-white">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{features.length} объектов</span>
                    <button className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"><Download size={16} /></button>
                </div>
            </div>

            {/* ─── Rollback Confirmation Popup ─────────────────── */}
            {rollbackPopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-4 border border-gray-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <Clock size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Откатить изменения?</h3>
                                <p className="text-xs text-gray-500">Версия от {rollbackPopup.formattedDate}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-600 mb-5 bg-gray-50 rounded-lg p-3">
                            Объект <strong>"{rollbackPopup.featureName}"</strong> будет возвращён к предыдущему состоянию. Текущие изменения будут записаны в историю.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setRollbackPopup(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={confirmRollback}
                                className="flex-1 px-4 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-lg shadow-amber-500/25"
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
        <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition ${isSelected ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent'}`} onClick={onSelect}>
            <span className="text-[10px] text-gray-400" title={geoType}>{geoIcon}</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getSafeStyle(feature.featureClass).fillColor }} />
            {editing ? (
                <input className="flex-1 text-[11px] bg-white border border-indigo-300 rounded px-1" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { updateFeature(feature.id, { name }); setEditing(false) }} autoFocus />
            ) : (
                <span className="flex-1 text-[11px] text-gray-700 truncate" onDoubleClick={() => setEditing(true)}>{feature.name}</span>
            )}
            <button onClick={(e) => { e.stopPropagation(); onToggleVisibility() }} className="text-gray-300 hover:text-gray-600" title={feature.visible ? 'Скрыть' : 'Показать'}>
                {feature.visible ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                )}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onToggleLock() }} className="text-gray-300 hover:text-gray-600" title={feature.locked ? 'Разблокировать' : 'Заблокировать'}>
                {feature.locked ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 019.9-1" /></svg>
                )}
            </button>
        </div>
    )
}
