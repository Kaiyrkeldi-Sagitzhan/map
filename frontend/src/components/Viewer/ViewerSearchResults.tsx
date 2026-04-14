import { useViewerStore } from '../../store/viewerStore'
import { useState } from 'react'
import { Search, X, Eye, ChevronRight } from 'lucide-react'
import { getSafeStyle } from '../../types/editor'

const DISABLED_TYPES = new Set(['building', 'city'])

const CLASS_LABELS: Record<string, string> = {
    lake: 'Озеро', river: 'Река', forest: 'Лес', road: 'Дорога',
    building: 'Здание', city: 'Нас. пункт', mountain: 'Гора',
    boundary: 'Граница', other: 'Другое',
}

export default function ViewerSearchResults() {
    const searchResults = useViewerStore((s) => s.searchResults)
    const activeTool = useViewerStore((s) => s.activeTool)
    const clearSearchResults = useViewerStore((s) => s.clearSearchResults)
    const setSelectedFeature = useViewerStore((s) => s.setSelectedFeature)
    const setHighlight = useViewerStore((s) => s.setHighlight)
    const fetchFeatureHistory = useViewerStore((s) => s.fetchFeatureHistory)

    const [isCollapsed, setIsCollapsed] = useState(false)
    const filteredResults = searchResults.filter((r) => !DISABLED_TYPES.has(r.type))

    if (filteredResults.length === 0) return null

    const handleResultClick = (result: typeof searchResults[0]) => {
        setSelectedFeature(result)
        if (result.geometry) {
            setHighlight(result.geometry, {
                color: '#ff4500',
                fillColor: '#ff4500',
                weight: 4,
                fillOpacity: 0.25,
            })
            // Fly to feature
            const map = (window as any).leafletMap
            if (map) {
                try {
                    const L = (window as any).L
                    if (L) {
                        const layer = L.geoJSON({ type: 'Feature', properties: {}, geometry: result.geometry })
                        const bounds = layer.getBounds()
                        if (bounds.isValid()) {
                            map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 })
                        }
                    }
                } catch { /* ignore */ }
            }
        }
        if (activeTool === 'history') {
            fetchFeatureHistory(result.backendId || result.id)
        }
    }

    return (
        <div className={`fixed left-6 z-[1000] bg-[#020C1B]/95 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 flex flex-col pointer-events-auto transition-all duration-300 ${isCollapsed ? 'top-[calc(7rem+40vh+12px)] w-12 h-12 rounded-xl' : 'top-[calc(7rem+40vh+12px)] w-[300px] max-h-[40vh] rounded-2xl'}`}>
            {/* Header */}
            <div className={`${isCollapsed ? 'p-0 h-full border-none' : 'px-5 py-3 border-b border-white/5 bg-white/[0.02]'} flex items-center justify-between`}>
                <button
                    onClick={() => setIsCollapsed((v) => !v)}
                    className={`${isCollapsed ? 'w-full h-full flex items-center justify-center text-slate-300 hover:text-white' : 'text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2 hover:text-white'} transition-colors`}
                >
                    {isCollapsed ? (
                        <Search className="w-4 h-4 text-[#10B981]" />
                    ) : (
                        <>
                            <ChevronRight className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                            <Search className="w-3 h-3" />
                            Найдено: {filteredResults.length}
                        </>
                    )}
                </button>
                <button
                    onClick={clearSearchResults}
                    className={`${isCollapsed ? 'hidden' : 'p-1.5'} hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors`}
                >
                    <X size={14} />
                </button>
            </div>

            {!isCollapsed && (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredResults.slice(0, 50).map((r) => {
                        const style = getSafeStyle(r.type)
                        return (
                            <button
                                key={r.id}
                                onClick={() => handleResultClick(r)}
                                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-all group border-b border-white/[0.03] last:border-0"
                            >
                                <div
                                    className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 flex-shrink-0"
                                    style={{ backgroundColor: style.fillColor }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-bold text-slate-200 group-hover:text-white transition-colors truncate">
                                        {r.name}
                                    </div>
                                    <div className="text-[9px] text-[#10B981] uppercase font-black tracking-widest mt-0.5 opacity-60">
                                        {CLASS_LABELS[r.type] || r.type}
                                    </div>
                                </div>
                                <Eye size={14} className="text-slate-800 group-hover:text-[#10B981] transition-all flex-shrink-0" />
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
