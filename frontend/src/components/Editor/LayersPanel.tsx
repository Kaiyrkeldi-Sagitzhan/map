import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { getSafeStyle, getSafeLabel } from '../../types/editor'
import type { EditHistoryEntry, EditorFeature, FeatureClass } from '../../types/editor'
import { 
    Download, 
    Layers, 
    Clock, 
    Trash2, 
    ChevronRight, 
    Eye, 
    EyeOff, 
    Lock, 
    Unlock, 
    History,
    RotateCcw,
    Hexagon,
    Minus,
    MapPin,
    ExternalLink,
    XCircle
} from 'lucide-react'
import { apiService } from '../../services/api'

const ACTION_LABELS: Record<EditHistoryEntry['action'], { label: string; color: string; bgColor: string }> = {
    create: { label: 'Создание', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    update: { label: 'Изменение', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    delete: { label: 'Удаление', color: 'text-red-400', bgColor: 'bg-red-500/10' },
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
        removeFromProject,
        removeClassFromProject
    } = useEditorStore()

    const [activeTab, setActiveTab] = useState<'layers' | 'history'>('layers')
    const [rollbackPopup, setRollbackPopup] = useState<any | null>(null)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'layer' | 'feature', id: string, fc?: FeatureClass } | null>(null)
    const previewRestore = useRef<EditorFeature | null>(null)

    // Auto-switch to history tab when history tool is active
    useEffect(() => {
        if (currentTool === 'history') setActiveTab('history')
    }, [currentTool])

    // Fetch history when selected feature changes
    useEffect(() => {
        if (selectedFeatureId && activeTab === 'history') {
            const state = useEditorStore.getState()
            const feat = state.features.find(f => f.id === selectedFeatureId)
            const backendId = feat?.backendId || selectedFeatureId
            fetchFeatureHistory(backendId)
        }
    }, [selectedFeatureId, activeTab, fetchFeatureHistory])

    // Fetch history when switching to history tab if a feature is already selected
    useEffect(() => {
        if (activeTab === 'history' && selectedFeatureId && serverHistory.length === 0) {
            const feat = features.find(f => f.id === selectedFeatureId)
            if (feat) {
                fetchFeatureHistory(feat.backendId || feat.id)
            }
        }
    }, [activeTab])

    // Close context menu on click outside
    useEffect(() => {
        const hide = () => setContextMenu(null)
        const handleWindowContextMenu = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.context-menu-trigger')) hide()
        }

        window.addEventListener('click', hide)
        window.addEventListener('contextmenu', handleWindowContextMenu)
        
        return () => {
            window.removeEventListener('click', hide)
            window.removeEventListener('contextmenu', handleWindowContextMenu)
        }
    }, [])

    const handleContextMenu = (e: React.MouseEvent, type: 'layer' | 'feature', id: string, fc?: FeatureClass) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, type, id, fc })
    }

    const handleEntryHover = useCallback((entry: any) => {
        const snap = entry.afterSnapshot
        if (!snap || !selectedFeatureId) return
        
        const store = useEditorStore.getState()
        const current = store.features.find(f => f.id === selectedFeatureId)
        if (!current) return

        previewRestore.current = { ...current }
        
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
                
                try {
                    const restoredObj = await apiService.getGeoObjectById(backendId)
                    if (restoredObj) {
                        state.updateFeature(selectedFeatureId, {
                            geometry: restoredObj.geometry as any,
                            metadata: restoredObj.metadata as any,
                            name: restoredObj.name,
                            description: restoredObj.description || ''
                        })
                    }
                } catch (fetchErr) {
                    console.error('[Rollback] Failed to fetch restored object:', fetchErr)
                }

                await fetchFeatureHistory(backendId)
                window.dispatchEvent(new Event('refresh-map'))
            }
            setRollbackPopup(null)
        } catch (err) {
            console.error('[Rollback] Error:', err)
            alert('Ошибка при откате изменений')
        }
    }, [rollbackPopup, selectedFeatureId, rollbackToHistory, fetchFeatureHistory])

    return (
        <>
            <div className="fixed top-28 left-6 bottom-28 w-[300px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px]">
                {/* Tabs */}
                <div className="p-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex bg-black/40 rounded-xl p-1">
                        <button
                            onClick={() => setActiveTab('layers')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'layers' ? 'bg-[#10B981] text-[#020C1B] shadow-lg shadow-[#10B981]/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Layers size={14} /> Слои
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'history' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Clock size={14} /> История
                        </button>
                    </div>
                </div>

                {activeTab === 'layers' ? (
                    <>
                        {/* Map Opacity Control */}
                        <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.1em]">Прозрачность карты</span>
                                <span className="text-[10px] font-mono text-[#10B981]">{Math.round(mapOpacity * 100)}%</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.01" value={mapOpacity} onChange={(e) => setMapOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#10B981]" />
                        </div>

                        <div className="flex-1 overflow-y-auto py-2 px-2 custom-scrollbar">
                            {layers.map((layer) => {
                                const layerFeatures = features.filter(f => f.featureClass === layer.featureClass)
                                return (
                                    <div key={layer.id} className="mb-1">
                                        <div 
                                            className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition-all context-menu-trigger ${!layer.visible ? 'opacity-40' : ''}`} 
                                            onClick={() => toggleLayerExpand(layer.id)}
                                            onContextMenu={(e) => handleContextMenu(e, 'layer', layer.id, layer.featureClass)}
                                        >
                                            <ChevronRight size={14} className={`text-slate-600 transition-transform duration-200 ${layer.expanded ? 'rotate-90 text-white' : ''}`} />
                                            <div className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: getSafeStyle(layer.featureClass).fillColor }} />
                                            <span className="flex-1 text-[11px] font-bold text-slate-200 truncate uppercase tracking-wide">{getSafeLabel(layer.featureClass)}</span>
                                            <span className="text-[9px] text-slate-500 font-bold bg-white/5 px-2 py-0.5 rounded-md group-hover:bg-[#10B981]/10 group-hover:text-[#10B981] transition-colors">{layerFeatures.length}</span>
                                        </div>
                                        {layer.expanded && (
                                            <div className="mt-0.5 ml-4 border-l border-white/5 pl-2 space-y-px">
                                                {[...layerFeatures].reverse().map((feature) => (
                                                    <FeatureItem
                                                        key={feature.id}
                                                        feature={feature}
                                                        isSelected={feature.id === selectedFeatureId}
                                                        onSelect={() => setSelectedFeature(feature.id)}
                                                        onToggleVisibility={() => toggleFeatureVisibility(feature.id)}
                                                        onToggleLock={() => toggleFeatureLock(feature.id)}
                                                        onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, 'feature', feature.id)}
                                                        onRemove={() => {
                                                            const state = useEditorStore.getState()
                                                            state.removeFromProject(feature.id)
                                                        }}
                                                    />
                                                ))}
                                                {layerFeatures.length === 0 && (
                                                    <div className="py-2 px-3 text-[10px] text-slate-600 italic">Слой пуст</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                ) : (
                    /* HISTORY TAB */
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {!selectedFeatureId ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                                    <History size={24} className="text-slate-700 opacity-50" />
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Объект не выбран</p>
                                <p className="text-[10px] text-slate-600 mt-2">Выберите объект на карте, чтобы увидеть историю его изменений</p>
                            </div>
                        ) : serverHistory.length > 0 ? (
                            <div className="relative pl-4 mt-2">
                                <div className="absolute left-1 top-2 bottom-2 w-px bg-gradient-to-b from-[#10B981] via-white/10 to-transparent" />
                                <div className="space-y-6">
                                    {[...serverHistory]
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                        .map((entry, idx) => {
                                        const actionInfo = ACTION_LABELS[entry.action] || { label: entry.action, color: 'text-slate-400', bgColor: 'bg-slate-500/10' }
                                        const isLatest = idx === 0
                                        const before = entry.beforeSnapshot
                                        const after = entry.afterSnapshot
                                        const changes: string[] = []
                                        if (before && after) {
                                            if (before.name !== after.name) changes.push(`Имя: "${before.name}" → "${after.name}"`)
                                            if (before.type !== after.type) changes.push(`Тип: ${before.type} → ${after.type}`)
                                            if (before.scope !== after.scope) changes.push(`Область: ${before.scope} → ${after.scope}`)
                                            if (JSON.stringify(before.geometry) !== JSON.stringify(after.geometry)) changes.push('Геометрия изменена')
                                            if (before.description !== after.description) changes.push('Описание изменено')
                                            if (JSON.stringify(before.metadata) !== JSON.stringify(after.metadata)) changes.push('Стиль изменён')
                                        }
                                        return (
                                            <div
                                                key={entry.id}
                                                className="relative group cursor-pointer"
                                                onMouseEnter={() => handleEntryHover(entry)}
                                                onMouseLeave={handleEntryLeave}
                                                onClick={() => handleRollback(entry)}
                                            >
                                                <div className={`absolute -left-[15px] top-2.5 w-2 h-2 rounded-full border z-10 transition-all duration-300 ${isLatest ? 'bg-[#10B981] border-white scale-125 shadow-[0_0_10px_#10B981]' : 'bg-slate-900 border-slate-700'}`} />

                                                <div className={`p-3 rounded-xl border transition-all duration-300 ${isLatest ? 'bg-white/10 border-[#10B981]/30 shadow-lg' : 'bg-white/5 border-transparent hover:border-white/10 hover:bg-white/10'}`}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${actionInfo.bgColor} ${actionInfo.color}`}>
                                                            {actionInfo.label}
                                                        </span>
                                                        <span className="text-[9px] text-slate-500 font-mono">{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <p className="text-[11px] font-medium text-slate-200 leading-snug">{entry.description}</p>

                                                    {changes.length > 0 && (
                                                        <div className="mt-1.5 space-y-0.5">
                                                            {changes.map((c, i) => (
                                                                <p key={i} className="text-[9px] text-amber-400/80 leading-snug">{c}</p>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                                        <span className={`text-[8px] uppercase font-bold tracking-wider ${isLatest ? 'text-[#10B981]' : 'text-slate-600'}`}>{isLatest ? 'Текущая версия' : 'Версия из истории'}</span>
                                                        {!isLatest && (
                                                            <RotateCcw size={12} className="text-[#10B981] opacity-0 group-hover:opacity-100 transition-all transform group-hover:-rotate-45" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Clock size={32} className="text-slate-700 mb-4 opacity-20" />
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">История пуста</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="px-5 py-3 border-t border-white/5 bg-black/20">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{features.length} объектов</span>
                        <button className="p-2 text-slate-400 hover:text-[#10B981] hover:bg-white/5 rounded-lg transition-all" title="Экспорт проекта"><Download size={16} /></button>
                    </div>
                </div>
            </div>

            {/* ─── Context Menu (Outside panel to avoid clipping) ─── */}
            {contextMenu && (
                <div 
                    className="fixed z-[10000] min-w-[180px] bg-[#0A192F]/95 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-xl py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    {contextMenu.type === 'layer' ? (
                        <button 
                            onClick={() => {
                                if (contextMenu.fc) removeClassFromProject(contextMenu.fc)
                                setContextMenu(null)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <XCircle size={14} /> Убрать все объекты слоя
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={() => {
                                    removeFromProject(contextMenu.id)
                                    setContextMenu(null)
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5 transition-colors"
                            >
                                <ExternalLink size={14} /> Убрать из проекта
                            </button>
                            <button 
                                onClick={() => {
                                    const state = useEditorStore.getState()
                                    state.deleteFeature(contextMenu.id)
                                    setContextMenu(null)
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5 mt-1 pt-2"
                            >
                                <Trash2 size={14} /> Удалить навсегда
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ─── Rollback Confirmation Popup ─────────────────── */}
            {rollbackPopup && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#0A192F] rounded-[24px] shadow-2xl p-6 max-w-sm w-full border border-white/10 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                <RotateCcw size={22} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Откатить изменения?</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Версия от {new Date(rollbackPopup.createdAt).toLocaleString('ru-RU')}</p>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-6">
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Объект <span className="text-white font-bold">"{rollbackPopup.featureName || 'Без названия'}"</span> будет возвращён к этому состоянию. Все текущие изменения будут сохранены в истории.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setRollbackPopup(null)}
                                className="flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all border border-white/5"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={confirmRollback}
                                className="flex-1 px-4 py-3 text-[10px] font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-[#020C1B] rounded-xl transition-all shadow-lg shadow-amber-500/20"
                            >
                                Откатить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function FeatureItem({ feature, isSelected, onSelect, onToggleVisibility, onToggleLock, onRemove, onContextMenu }: any) {
    const updateFeature = useEditorStore((s) => s.updateFeature)
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(feature.name)

    const geoType = feature.geometry?.type || ''
    let geoIcon = <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getSafeStyle(feature.featureClass).fillColor }} />
    if (geoType.includes('Polygon')) geoIcon = <Hexagon size={10} className="text-slate-500" />
    else if (geoType.includes('Line')) geoIcon = <Minus size={10} className="text-slate-500" />
    else if (geoType.includes('Point')) geoIcon = <MapPin size={10} className="text-slate-500" />

    return (
        <div 
            className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all border context-menu-trigger ${isSelected ? 'bg-[#10B981]/10 border-[#10B981]/20' : 'hover:bg-white/5 border-transparent'}`} 
            onClick={onSelect}
            onContextMenu={onContextMenu}
        >
            <div className="shrink-0 w-4 flex justify-center">{geoIcon}</div>
            
            {editing ? (
                <input 
                    className="flex-1 text-[11px] bg-white/10 border border-[#10B981]/40 rounded px-1.5 py-0.5 text-white outline-none" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    onBlur={() => { updateFeature(feature.id, { name }); setEditing(false) }} 
                    autoFocus 
                    onClick={e => e.stopPropagation()}
                />
            ) : (
                <span className={`flex-1 text-[11px] truncate transition-colors ${isSelected ? 'text-white font-bold' : 'text-slate-400 group-hover:text-slate-200'}`} onDoubleClick={() => setEditing(true)}>{feature.name}</span>
            )}
            
            <div className={`flex items-center gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); onToggleVisibility() }} className={`p-1 rounded hover:bg-white/10 transition-colors ${feature.visible ? 'text-slate-500' : 'text-amber-500'}`}>
                    {feature.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onToggleLock() }} className={`p-1 rounded hover:bg-white/10 transition-colors ${feature.locked ? 'text-amber-500' : 'text-slate-500'}`}>
                    {feature.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="p-1 rounded hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    )
}
