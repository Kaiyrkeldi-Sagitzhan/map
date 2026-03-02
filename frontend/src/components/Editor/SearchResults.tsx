import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Search, MapPin, Navigation, Mountain } from 'lucide-react'

const SearchResults: React.FC = () => {
    const searchResults = useEditorStore((s) => s.searchResults)
    const clearSearchResults = useEditorStore((s) => s.clearSearchResults)
    const addFeature = useEditorStore((s) => s.addFeature)

    if (searchResults.length === 0) return null

    const handleAddAll = () => {
        searchResults.forEach(f => {
            addFeature({ ...f, id: crypto.randomUUID() })
        })
        clearSearchResults()
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'lake':
            case 'river': return <Navigation className="w-3 h-3 text-blue-500" />
            case 'mountain': return <Mountain className="w-3 h-3 text-slate-500" />
            default: return <MapPin className="w-3 h-3 text-indigo-500" />
        }
    }

    return (
        <div className="absolute top-20 left-4 z-[1000] w-64 max-h-[40vh] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col pointer-events-auto">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Search className="w-3 h-3" />
                    <span>Найдено {searchResults.length}</span>
                </h3>
                <button 
                    onClick={clearSearchResults}
                    className="p-1 hover:bg-gray-100 rounded text-gray-400"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {searchResults.slice(0, 50).map((f) => (
                    <div
                        key={f.id}
                        className="w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-3 bg-gray-50/50 border border-transparent"
                    >
                        {getIcon(f.featureClass)}
                        <span className="truncate flex-1">{f.name}</span>
                        <button 
                            onClick={() => {
                                addFeature({ ...f, id: crypto.randomUUID() })
                            }}
                            className="p-1 hover:bg-indigo-100 text-indigo-600 rounded"
                            title="Добавить в слои"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
            <div className="p-2 border-t border-gray-100">
                <button 
                    onClick={handleAddAll}
                    className="w-full py-1.5 text-[10px] font-bold uppercase bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                >
                    Добавить все в проект
                </button>
            </div>
        </div>
    )
}

export default SearchResults
