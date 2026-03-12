import { useState, useEffect, useRef, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { apiService } from '../../services/api'
import { CLASS_LABELS, CLASS_STYLES, getSafeStyle } from '../../types/editor'
import type { FeatureClass } from '../../types/editor'

interface SearchResult {
    id: string
    name: string
    type: string
    description: string
    geometry: GeoJSON.Geometry
}

const SEARCH_TYPES: { value: string; label: string }[] = [
    { value: '', label: 'Все типы' },
    { value: 'lake', label: 'Озера' },
    { value: 'river', label: 'Реки' },
    { value: 'forest', label: 'Лес' },
    { value: 'road', label: 'Дорога' },
    { value: 'building', label: 'Здание' },
]

export default function TextSearch() {
    const map = useMap()
    const [query, setQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const highlightLayerRef = useRef<any>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout>>()
    const containerRef = useRef<HTMLDivElement>(null)

    const clearHighlight = useCallback(() => {
        if (highlightLayerRef.current && map) {
            map.removeLayer(highlightLayerRef.current)
            highlightLayerRef.current = null
        }
    }, [map])

    const doSearch = useCallback(async (text: string, type: string) => {
        if (text.length < 2) {
            setResults([])
            return
        }
        setIsSearching(true)
        try {
            const res = await apiService.getGeoObjects(type || undefined, undefined, text)
            const items: SearchResult[] = res.objects.slice(0, 20).map(obj => ({
                id: obj.id as string,
                name: obj.name,
                type: obj.type,
                description: obj.description || '',
                geometry: obj.geometry as GeoJSON.Geometry,
            }))
            setResults(items)
        } catch (err) {
            console.error('Text search failed:', err)
            setResults([])
        } finally {
            setIsSearching(false)
        }
    }, [])

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (query.length < 2) {
            setResults([])
            return
        }
        debounceRef.current = setTimeout(() => {
            doSearch(query, typeFilter)
        }, 300)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [query, typeFilter, doSearch])

    // Prevent leaflet from capturing clicks/scroll on this overlay
    useEffect(() => {
        if (containerRef.current) {
            L.DomEvent.disableClickPropagation(containerRef.current)
            L.DomEvent.disableScrollPropagation(containerRef.current)
        }
    }, [])

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleResultClick = (result: SearchResult) => {
        if (!map) return
        clearHighlight()

        const geoJsonLayer = L.geoJSON({
            type: 'Feature',
            properties: {},
            geometry: result.geometry,
        } as GeoJSON.Feature)
        const bounds = geoJsonLayer.getBounds()

        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
        }

        const style = getSafeStyle(result.type)
        const highlight = L.geoJSON(
            { type: 'Feature', properties: {}, geometry: result.geometry } as GeoJSON.Feature,
            {
                style: () => ({
                    color: '#10B981',
                    fillColor: style.fillColor,
                    fillOpacity: 0.4,
                    weight: 4,
                    dashArray: '8,4',
                }),
            }
        ).addTo(map)
        highlightLayerRef.current = highlight

        setTimeout(() => {
            if (highlightLayerRef.current === highlight) {
                clearHighlight()
            }
        }, 5000)
    }

    const getTypeIcon = (type: string) => {
        const style = CLASS_STYLES[type as FeatureClass] || CLASS_STYLES.custom
        return (
            <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: style.fillColor }}
            />
        )
    }

    const getTypeLabel = (type: string) => {
        return CLASS_LABELS[type as FeatureClass] || type
    }

    return (
        <div
            ref={containerRef}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]"
            style={{ pointerEvents: 'auto' }}
        >
            {/* Search input bar */}
            <div className="flex items-center gap-2 bg-[#020C1B]/80 backdrop-blur-xl rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/[0.06] px-4 py-2 min-w-[380px]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 flex-shrink-0">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        if (e.target.value.length >= 2) setIsOpen(true)
                    }}
                    onFocus={() => { if (results.length > 0) setIsOpen(true) }}
                    placeholder="Поиск по названию..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 px-1"
                />
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/[0.06] rounded-full px-2.5 py-1 text-slate-400 outline-none cursor-pointer [&>option]:bg-[#0A192F] [&>option]:text-white"
                >
                    {SEARCH_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
                {isSearching && (
                    <svg className="animate-spin h-4 w-4 text-[#10B981] flex-shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                )}
                {query && (
                    <button
                        onClick={() => { setQuery(''); setResults([]); setIsOpen(false); clearHighlight() }}
                        className="p-0.5 hover:bg-white/10 rounded-full text-slate-500 transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Results dropdown */}
            {isOpen && results.length > 0 && (
                <div className="mt-2 bg-[#0A192F]/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/[0.06] max-h-[300px] overflow-y-auto custom-scrollbar">
                    <div className="px-4 py-2.5 border-b border-white/5">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">
                            Найдено {results.length}
                        </span>
                    </div>
                    {results.map(r => (
                        <button
                            key={r.id}
                            onClick={() => handleResultClick(r)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/[0.03] last:border-0"
                        >
                            {getTypeIcon(r.type)}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white truncate">{r.name}</div>
                                <div className="text-[10px] text-slate-500">{getTypeLabel(r.type)}</div>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600 flex-shrink-0">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>
                    ))}
                </div>
            )}

            {/* No results message */}
            {isOpen && query.length >= 2 && !isSearching && results.length === 0 && (
                <div className="mt-2 bg-[#0A192F]/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/[0.06] px-4 py-3 text-center">
                    <span className="text-sm text-slate-500">Ничего не найдено</span>
                </div>
            )}
        </div>
    )
}
