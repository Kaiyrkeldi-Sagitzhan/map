/**
 * ViewerLayersPanel.tsx — Left sidebar for the viewer (history-only).
 * Shows selected object info + its edit history timeline.
 */
import { useEffect } from 'react'
import { useViewerStore } from '../../store/viewerStore'
import { Clock, History, ZoomIn, MousePointer2 } from 'lucide-react'
import { getSafeStyle } from '../../types/editor'

const ACTION_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
    create: { label: 'Создание', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    update: { label: 'Изменение', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    delete: { label: 'Удаление', color: 'text-red-400', bgColor: 'bg-red-500/10' },
}

const CLASS_LABELS: Record<string, string> = {
    lake: 'Озеро', river: 'Река', forest: 'Лес', road: 'Дорога',
    building: 'Здание', city: 'Нас. пункт', mountain: 'Гора',
    boundary: 'Граница', other: 'Другое',
}

export default function ViewerLayersPanel() {
    const selectedFeature = useViewerStore((s) => s.selectedFeature)
    const selectedFeatureId = useViewerStore((s) => s.selectedFeatureId)
    const serverHistory = useViewerStore((s) => s.serverHistory)
    const objectVersions = useViewerStore((s) => s.objectVersions)
    const objectSnapshots = useViewerStore((s) => s.objectSnapshots)
    const fetchFeatureHistory = useViewerStore((s) => s.fetchFeatureHistory)
    const fetchFeatureSnapshots = useViewerStore((s) => s.fetchFeatureSnapshots)
    const setHighlight = useViewerStore((s) => s.setHighlight)
    const clearHighlight = useViewerStore((s) => s.clearHighlight)
    const mapOpacity = useViewerStore((s) => s.mapOpacity)
    const setMapOpacity = useViewerStore((s) => s.setMapOpacity)

    // Auto-fetch history when feature is selected
    useEffect(() => {
        if (selectedFeature?.backendId || selectedFeatureId) {
            fetchFeatureHistory(selectedFeature?.backendId || selectedFeatureId!)
            fetchFeatureSnapshots(selectedFeature?.backendId || selectedFeatureId!)
        }
    }, [selectedFeatureId, fetchFeatureSnapshots])

    const handleHistoryHover = (entry: typeof serverHistory[0]) => {
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

    const handleHistoryClick = (entry: typeof serverHistory[0]) => {
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
                } catch { /* ignore */ }
            }
        }
    }

    const featureStyle = selectedFeature ? getSafeStyle(selectedFeature.type) : null

    return (
        <div className="fixed top-28 left-6 bottom-28 w-[300px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col z-[500] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px]">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-1">
                    <History size={14} className="text-[#10B981]" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">История объекта</span>
                </div>
            </div>

            {/* Selected Object Info */}
            {selectedFeature && (
                <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-3 h-3 rounded-full ring-2 ring-white/20 flex-shrink-0"
                            style={{ backgroundColor: featureStyle?.fillColor || '#10B981' }}
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-bold text-white truncate">
                                {selectedFeature.name}
                            </div>
                            <div className="text-[9px] text-[#10B981] uppercase font-black tracking-widest mt-0.5 opacity-60">
                                {CLASS_LABELS[selectedFeature.type] || selectedFeature.type}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Map Opacity */}
            <div className="px-5 py-3 border-b border-white/5 bg-white/[0.01]">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.1em]">Подложка</span>
                    <span className="text-[10px] font-mono text-[#10B981]">{Math.round(mapOpacity * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.01" value={mapOpacity} onChange={(e) => setMapOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#10B981]" />
            </div>

            {/* History Timeline */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {!selectedFeatureId ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-5 border border-white/5">
                            <MousePointer2 size={24} className="text-slate-700 opacity-50" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Объект не выбран</p>
                        <p className="text-[10px] text-slate-600 mt-3 leading-relaxed">
                            Нажмите на объект на карте<br/>
                            чтобы увидеть историю<br/>
                            его изменений
                        </p>
                    </div>
                ) : (objectVersions.length > 0 || serverHistory.length > 0 || objectSnapshots.length > 0) ? (
                    <div className="relative pl-4 mt-2">
                        <div className="absolute left-1 top-2 bottom-2 w-px bg-gradient-to-b from-[#10B981] via-white/10 to-transparent" />
                        <div className="space-y-4">
                            {/* Versions */}
                            {[...objectVersions]
                                .sort((a, b) => b.id.localeCompare(a.id)) // Sort by version (id)
                                .map((version, idx) => {
                                const isLatest = idx === 0
                                return (
                                    <div
                                        key={version.id}
                                        className="relative group"
                                        onMouseEnter={() => version.geometry && setHighlight(version.geometry, { color: '#3b82f6', fillColor: '#3b82f6', weight: 4, fillOpacity: 0.25, dashArray: '8,4' })}
                                        onMouseLeave={handleHistoryLeave}
                                    >
                                        <div className={`absolute -left-[15px] top-2.5 w-2 h-2 rounded-full border z-10 transition-all duration-300 ${isLatest ? 'bg-[#10B981] border-white scale-125 shadow-[0_0_10px_#10B981]' : 'bg-slate-900 border-slate-700 group-hover:bg-purple-500 group-hover:border-purple-400 group-hover:shadow-[0_0_8px_#a855f7]'}`} />

                                        <div className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                                            isLatest
                                                ? 'bg-white/10 border-[#10B981]/30 shadow-lg'
                                                : 'bg-white/[0.03] border-transparent hover:bg-white/[0.08] hover:border-purple-500/30'
                                        }`}
                                            onClick={() => version.geometry && setHighlight(version.geometry, { color: '#f59e0b', fillColor: '#f59e0b', weight: 4, fillOpacity: 0.3, dashArray: '6,6' })}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-purple-500/10 text-purple-400`}>
                                                    Версия {version.id.split('-').pop() || '0'}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {version.geometry && (
                                                        <ZoomIn size={10} className="text-slate-700 group-hover:text-purple-400 transition-colors" />
                                                    )}
                                                    <span className="text-[9px] text-slate-500 font-mono">{new Date((version as any).createdAt || '').toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-200 leading-snug">{version.name}</p>

                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                                <span className={`text-[8px] uppercase font-bold tracking-wider ${isLatest ? 'text-[#10B981]' : 'text-slate-600'}`}>
                                                    {isLatest ? 'Текущая версия' : `Версия ${version.id.split('-').pop() || '0'}`}
                                                </span>
                                                {version.geometry && !isLatest && (
                                                    <span className="text-[8px] text-purple-400/50 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Нажмите для просмотра
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {/* Snapshots/Versions */}
                            {[...objectSnapshots]
                                .sort((a, b) => b.version - a.version)
                                .map((snapshot: any, idx) => {
                                const isLatest = idx === 0
                                return (
                                    <div
                                        key={snapshot.id}
                                        className="relative group"
                                        onMouseEnter={() => snapshot.geometry && setHighlight(snapshot.geometry, { color: '#8b5cf6', fillColor: '#8b5cf6', weight: 4, fillOpacity: 0.25, dashArray: '8,4' })}
                                        onMouseLeave={handleHistoryLeave}
                                    >
                                        <div className={`absolute -left-[15px] top-2.5 w-2 h-2 rounded-full border z-10 transition-all duration-300 ${isLatest ? 'bg-[#10B981] border-white scale-125 shadow-[0_0_10px_#10B981]' : 'bg-slate-900 border-slate-700 group-hover:bg-violet-500 group-hover:border-violet-400 group-hover:shadow-[0_0_8px_#8b5cf6]'}`} />

                                        <div className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                                            isLatest
                                                ? 'bg-white/10 border-[#10B981]/30 shadow-lg'
                                                : 'bg-white/[0.03] border-transparent hover:bg-white/[0.08] hover:border-violet-500/30'
                                        }`}
                                            onClick={() => snapshot.geometry && setHighlight(snapshot.geometry, { color: '#f59e0b', fillColor: '#f59e0b', weight: 4, fillOpacity: 0.3, dashArray: '6,6' })}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-violet-500/10 text-violet-400`}>
                                                    Версия {snapshot.version}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {snapshot.geometry && (
                                                        <ZoomIn size={10} className="text-slate-700 group-hover:text-violet-400 transition-colors" />
                                                    )}
                                                    <span className="text-[9px] text-slate-500 font-mono">{new Date(snapshot.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-200 leading-snug">{snapshot.name}</p>

                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                                <span className={`text-[8px] uppercase font-bold tracking-wider ${isLatest ? 'text-[#10B981]' : 'text-slate-600'}`}>
                                                    {isLatest ? 'Текущая версия' : `Версия ${snapshot.version}`}
                                                </span>
                                                {snapshot.geometry && !isLatest && (
                                                    <span className="text-[8px] text-violet-400/50 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Нажмите для просмотра
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {/* History */}
                            {[...serverHistory]
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map((entry, idx) => {
                                const actionInfo = ACTION_LABELS[entry.action] || { label: entry.action, color: 'text-slate-400', bgColor: 'bg-slate-500/10' }
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

                                        <div className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                                            isLatest
                                                ? 'bg-white/10 border-[#10B981]/30 shadow-lg'
                                                : 'bg-white/[0.03] border-transparent hover:bg-white/[0.08] hover:border-blue-500/30'
                                        }`}
                                            onClick={() => hasSnapshot && handleHistoryClick(entry)}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${actionInfo.bgColor} ${actionInfo.color}`}>
                                                    {actionInfo.label}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {hasSnapshot && (
                                                        <ZoomIn size={10} className="text-slate-700 group-hover:text-blue-400 transition-colors" />
                                                    )}
                                                    <span className="text-[9px] text-slate-500 font-mono">{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-200 leading-snug">{entry.description}</p>

                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                                <span className={`text-[8px] uppercase font-bold tracking-wider ${isLatest ? 'text-[#10B981]' : 'text-slate-600'}`}>
                                                    {isLatest ? 'Текущая версия' : new Date(entry.createdAt).toLocaleDateString('ru-RU')}
                                                </span>
                                                {hasSnapshot && !isLatest && (
                                                    <span className="text-[8px] text-blue-400/50 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Нажмите для просмотра
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Clock size={32} className="text-slate-700 mb-4 opacity-20" />
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">История пуста</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/5 bg-black/20">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Просмотр</span>
            </div>
        </div>
    )
}

