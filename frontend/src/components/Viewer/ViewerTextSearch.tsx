import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { apiService } from '../../services/api'
import { CLASS_LABELS, getSafeStyle } from '../../types/editor'
import type { FeatureClass } from '../../types/editor'
import { Search, X, Loader2, ChevronRight } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'

const SEARCH_TYPES: { value: string; label: string }[] = [
    { value: '', label: 'Все типы' },
    { value: 'lake', label: 'Озёра' },
    { value: 'river', label: 'Реки' },
    { value: 'forest', label: 'Леса' },
    { value: 'road', label: 'Дороги' },
    { value: 'building', label: 'Здания' },
    { value: 'city', label: 'Нас. пункты' },
    { value: 'other', label: 'Другое' },
]

export default function ViewerTextSearch() {
    const map = useMap()
    const { isSearching, setIsSearching, setSearchResults, clearSearchResults, featureClassFilter, setFeatureClassFilter } = useViewerStore()
    const [query, setQuery] = useState('')
    const typeFilter = featureClassFilter
    const setTypeFilter = setFeatureClassFilter
    const [localResults, setLocalResults] = useState<any[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [portalNode, setPortalNode] = useState<HTMLElement | null>(null)
    
    const highlightLayerRef = useRef<any>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout>>()
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const node = document.getElementById('header-search-portal')
        if (node) setPortalNode(node)
    }, [])

    const clearHighlight = useCallback(() => {
        if (highlightLayerRef.current && map) {
            map.removeLayer(highlightLayerRef.current)
            highlightLayerRef.current = null
        }
    }, [map])

    const doSearch = useCallback(async (text: string, type: string) => {
        if (text.length < 2) {
            setLocalResults([])
            return
        }
        setIsSearching(true)
        try {
            const res = await apiService.getGeoObjects(type || undefined, undefined, text)
            const items = res.objects.slice(0, 20).map(obj => ({
                id: obj.id as string,
                name: obj.name,
                type: obj.type,
                description: obj.description || '',
                geometry: obj.geometry as GeoJSON.Geometry,
                metadata: obj.metadata
            }))
            setLocalResults(items)
            setSearchResults(items)
        } catch (err) {
            console.error('Text search failed:', err)
            setLocalResults([])
            clearSearchResults()
        } finally {
            setIsSearching(false)
        }
    }, [setIsSearching, setSearchResults, clearSearchResults])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (query.length < 2) {
            setLocalResults([])
            return
        }
        debounceRef.current = setTimeout(() => {
            doSearch(query, typeFilter)
        }, 300)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [query, typeFilter, doSearch, clearSearchResults])

    useEffect(() => {
        if (containerRef.current) {
            L.DomEvent.disableClickPropagation(containerRef.current)
            L.DomEvent.disableScrollPropagation(containerRef.current)
        }
    }, [portalNode])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleResultClick = (result: any) => {
        if (!map) return
        clearHighlight()

        const geoJsonLayer = L.geoJSON({
            type: 'Feature',
            properties: {},
            geometry: result.geometry,
        } as GeoJSON.Feature)
        const bounds = geoJsonLayer.getBounds()

        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 })
        }

        const style = getSafeStyle(result.type)
        const highlight = L.geoJSON(
            { type: 'Feature', properties: {}, geometry: result.geometry } as GeoJSON.Feature,
            {
                style: () => ({
                    color: '#10B981',
                    fillColor: style.fillColor,
                    fillOpacity: 0.5,
                    weight: 5,
                    dashArray: '10,5',
                }),
            }
        ).addTo(map)
        highlightLayerRef.current = highlight

        setTimeout(() => {
            if (highlightLayerRef.current === highlight) {
                clearHighlight()
            }
        }, 8000)
        
        useViewerStore.getState().setSelectedFeature(result)
        setIsOpen(false)
    }

    if (!portalNode) return null

    return createPortal(
        <div ref={containerRef} className="relative w-full max-w-md pointer-events-auto">
            <div className={`
                flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl px-4 py-2
                transition-all duration-300 ${isOpen ? 'bg-black/40 border-[#10B981]/30 ring-4 ring-[#10B981]/5' : 'hover:bg-white/10'}
            `}>
                <Search size={16} className={`${isOpen ? 'text-[#10B981]' : 'text-slate-500'} transition-colors`} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        if (e.target.value.length >= 2) setIsOpen(true)
                    }}
                    onFocus={() => { if (localResults.length > 0) setIsOpen(true) }}
                    placeholder="Поиск объектов..."
                    className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-slate-600 px-0"
                />
                
                <div className="h-4 w-px bg-white/10 mx-1" />
                
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="text-[9px] font-bold uppercase tracking-widest bg-transparent text-slate-500 outline-none cursor-pointer hover:text-white transition-colors"
                    >
                        {SEARCH_TYPES.map(t => (
                            <option key={t.value} value={t.value} className="bg-[#020C1B] text-white">{t.label}</option>
                        ))}
                    </select>
                </div>

                {isSearching ? (
                    <Loader2 size={14} className="animate-spin text-[#10B981]" />
                ) : query && (
                    <button
                        onClick={() => { setQuery(''); setLocalResults([]); setIsOpen(false); clearHighlight(); clearSearchResults() }}
                        className="p-1 hover:bg-white/10 rounded-full text-slate-500 transition-colors"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {isOpen && (query.length >= 2 || localResults.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-4 bg-[#020C1B]/95 backdrop-blur-3xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[2000]">
                    {isSearching && localResults.length === 0 ? (
                        <div className="p-10 text-center">
                            <Loader2 size={24} className="animate-spin text-[#10B981] mx-auto mb-3 opacity-50" />
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Поиск...</span>
                        </div>
                    ) : localResults.length > 0 ? (
                        <>
                            <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    Результаты: {localResults.length}
                                </span>
                            </div>
                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                {localResults.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => handleResultClick(r)}
                                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 transition-all group/res border-b border-white/[0.03] last:border-0"
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: getSafeStyle(r.type).fillColor }} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[13px] font-bold text-slate-200 group-hover/res:text-white transition-colors truncate">{r.name}</div>
                                            <div className="text-[9px] text-[#10B981] uppercase font-black tracking-widest mt-0.5 opacity-60">{CLASS_LABELS[r.type as FeatureClass] || r.type}</div>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-800 group-hover/res:text-[#10B981] transition-all transform group-hover/res:translate-x-1" />
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : query.length >= 2 ? (
                        <div className="p-10 text-center">
                            <Search size={32} className="text-slate-900 mx-auto mb-3" />
                            <span className="text-[11px] text-slate-500 uppercase tracking-widest font-black">Объектов не найдено</span>
                        </div>
                    ) : null}
                </div>
            )}
        </div>,
        portalNode
    )
}
