import React from 'react'
import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Search, MapPin, Navigation, Mountain, ChevronRight } from 'lucide-react'

const DISABLED_TYPES = new Set(['building', 'city'])

const SearchResults: React.FC = () => {
    const searchResults = useEditorStore((s) => s.searchResults)
    const clearSearchResults = useEditorStore((s) => s.clearSearchResults)
    const addFeature = useEditorStore((s) => s.addFeature)

    const [isCollapsed, setIsCollapsed] = useState(false)
    const filteredResults = searchResults.filter((f) => !DISABLED_TYPES.has(f.featureClass))

    if (filteredResults.length === 0) return null

    const handleAddAll = () => {
        filteredResults.forEach(f => {
            addFeature({ ...f, id: crypto.randomUUID() })
        })
        clearSearchResults()
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'lake':
            case 'river': return <Navigation className="w-3 h-3 text-blue-400" />
            case 'mountain': return <Mountain className="w-3 h-3 text-slate-400" />
            default: return <MapPin className="w-3 h-3 text-[#10B981]" />
        }
    }

    return (
        <div className={`fixed left-6 z-[1000] w-[300px] bg-[#0A192F]/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/[0.06] flex flex-col pointer-events-auto transition-all duration-300 ${isCollapsed ? 'top-[calc(7rem+40vh+12px)] h-10' : 'top-[calc(7rem+40vh+12px)] max-h-[40vh]'}`}>
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <button
                    onClick={() => setIsCollapsed((v) => !v)}
                    className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] hover:text-slate-300 transition-colors"
                >
                    <ChevronRight className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                    <Search className="w-3 h-3" />
                    <span>Найдено {filteredResults.length}</span>
                </button>
                <button onClick={clearSearchResults} className="p-1 hover:bg-white/10 rounded-lg text-slate-500 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {!isCollapsed && (
                <>
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                        {filteredResults.slice(0, 50).map((f) => (
                            <div
                                key={f.id}
                                className="w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-3 hover:bg-white/5 transition-colors"
                            >
                                {getIcon(f.featureClass)}
                                <span className="truncate flex-1 text-slate-300 text-[12px]">{f.name}</span>
                                <button
                                    onClick={() => {
                                        addFeature({ ...f, id: crypto.randomUUID() })
                                    }}
                                    className="p-1 hover:bg-[#10B981]/10 text-[#10B981] rounded-lg transition-colors"
                                    title="Добавить в слои"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="p-2 border-t border-white/5">
                        <button
                            onClick={handleAddAll}
                            className="w-full py-2 text-[9px] font-black uppercase tracking-[0.15em] bg-[#10B981] text-[#020C1B] rounded-xl hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                        >
                            Добавить все в проект
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

export default SearchResults
