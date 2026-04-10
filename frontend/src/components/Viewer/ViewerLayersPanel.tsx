import { useMemo, useState } from 'react'
import { useViewerStore } from '../../store/viewerStore'
import { Layers, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { getSafeLabel, getSafeStyle } from '../../types/editor'

const LAYER_ORDER = ['lake', 'river', 'forest', 'road', 'mountain', 'boundary', 'other']

export default function ViewerLayersPanel() {
    const mapOpacity = useViewerStore((s) => s.mapOpacity)
    const setMapOpacity = useViewerStore((s) => s.setMapOpacity)
    const visibleLayers = useViewerStore((s) => s.visibleLayers)
    const toggleLayerVisibility = useViewerStore((s) => s.toggleLayerVisibility)
    const searchResults = useViewerStore((s) => s.searchResults)

    const [isCollapsed, setIsCollapsed] = useState(false)

    const layerCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const key of LAYER_ORDER) counts[key] = 0
        for (const item of searchResults) {
            if (counts[item.type] !== undefined) counts[item.type] += 1
        }
        return counts
    }, [searchResults])

    return (
        <div className={`fixed top-28 left-6 z-[500] w-[300px] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] rounded-[24px] transition-all duration-300 ${isCollapsed ? 'h-14' : 'h-[40vh]'}`}>
            <div className="p-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <button
                    onClick={() => setIsCollapsed((v) => !v)}
                    className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] hover:text-white transition-colors"
                >
                    <ChevronRight size={14} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                    <Layers size={14} className="text-[#10B981]" />
                    Слои
                </button>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{searchResults.length} найдено</span>
            </div>

            {!isCollapsed && (
                <>
                    <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.1em]">Подложка</span>
                            <span className="text-[10px] font-mono text-[#10B981]">{Math.round(mapOpacity * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={mapOpacity} onChange={(e) => setMapOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#10B981]" />
                    </div>

                    <div className="flex-1 overflow-y-auto py-2 px-2 custom-scrollbar">
                        {LAYER_ORDER.map((layerType) => {
                            const visible = visibleLayers.has(layerType)
                            return (
                                <button
                                    key={layerType}
                                    onClick={() => toggleLayerVisibility(layerType)}
                                    className={`w-full group flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all ${visible ? '' : 'opacity-50'}`}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: getSafeStyle(layerType as any).fillColor }} />
                                    <span className="flex-1 text-left text-[11px] font-bold text-slate-200 truncate uppercase tracking-wide">{getSafeLabel(layerType as any)}</span>
                                    <span className="text-[9px] text-slate-500 font-bold bg-white/5 px-2 py-0.5 rounded-md">{layerCounts[layerType] || 0}</span>
                                    <span className="text-slate-500 group-hover:text-white transition-colors">{visible ? <Eye size={13} /> : <EyeOff size={13} />}</span>
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}
