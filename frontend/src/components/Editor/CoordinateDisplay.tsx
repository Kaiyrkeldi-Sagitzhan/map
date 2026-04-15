/**
 * CoordinateDisplay.tsx
 * Bottom-left: [1:X scale — clickable dropdown via portal]
 * Bottom-right: [Lat / Lon]
 * Must be placed inside MapContainer to use useMap().
 *
 * Pills are rendered as portals positioned relative to the map container rect
 * so they escape the MapContainer stacking context (z-index:0) and always
 * appear above the floating toolbar.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import { useEditorStore } from '../../store/editorStore'
import { ChevronDown } from 'lucide-react'

// Standard Leaflet/OSM zoom-level scale denominators at 96 DPI at the equator.
// Formula: 591_657_550 / 2^zoom  (matches map minZoom=3 … maxZoom=18)
const ZOOM_SCALES: Record<number, number> = {
    3:  73_957_194,
    4:  36_978_597,
    5:  18_489_298,
    6:   9_244_649,
    7:   4_622_325,
    8:   2_311_162,
    9:   1_155_581,
    10:    577_791,
    11:    288_895,
    12:    144_448,
    13:     72_224,
    14:     36_112,
    15:     18_056,
    16:      9_028,
    17:      4_514,
    18:      2_257,
}

// Live scale: latitude-corrected (more accurate than equatorial lookup).
// Rounded to 3 significant figures.
function computeScale(zoom: number, lat: number): string {
    const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)
    const denom = Math.round(mpp * 3779.5275)
    if (denom <= 0) return '1 : —'
    const mag = Math.pow(10, Math.floor(Math.log10(denom)) - 2)
    const rounded = Math.round(denom / mag) * mag
    return `1 : ${rounded.toLocaleString('ru-RU')}`
}

interface PillPos { bottom: number; left: number; right: number }

export default function CoordinateDisplay() {
    const map = useMap()
    const mouseCoords = useEditorStore((s) => s.mouseCoords)
    const [zoom, setZoom] = useState(map.getZoom())
    const [centerLat, setCenterLat] = useState(map.getCenter().lat)
    const [open, setOpen] = useState(false)
    const [dropdownPos, setDropdownPos] = useState({ bottom: 0, left: 0 })
    const [pillPos, setPillPos] = useState<PillPos>({ bottom: 12, left: 12, right: 12 })
    const btnRef = useRef<HTMLButtonElement>(null)

    // Sync zoom / lat from map events
    useEffect(() => {
        const update = () => {
            setZoom(map.getZoom())
            setCenterLat(map.getCenter().lat)
        }
        map.on('zoomend moveend', update)
        return () => { map.off('zoomend moveend', update) }
    }, [map])

    // Recalculate pill position from map container bounds
    const updatePillPos = useCallback(() => {
        const rect = map.getContainer().getBoundingClientRect()
        setPillPos({
            bottom: window.innerHeight - rect.bottom + 12,
            left: rect.left + 12,
            right: window.innerWidth - rect.right + 12,
        })
    }, [map])

    useEffect(() => {
        updatePillPos()
        window.addEventListener('resize', updatePillPos)
        return () => window.removeEventListener('resize', updatePillPos)
    }, [updatePillPos])

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest('[data-scale-dropdown]') && !target.closest('[data-scale-btn]')) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleOpen = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            setDropdownPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left })
        }
        setOpen((v) => !v)
    }

    const currentScale = computeScale(zoom, centerLat)
    const latDir = mouseCoords ? (mouseCoords.lat >= 0 ? 'N' : 'S') : ''
    const lngDir = mouseCoords ? (mouseCoords.lng >= 0 ? 'E' : 'W') : ''

    return (
        <>
            {/* Scale pill — portal so it escapes MapContainer stacking context */}
            {createPortal(
                <div style={{ position: 'fixed', bottom: pillPos.bottom, left: pillPos.left, zIndex: 6000 }}>
                    <button
                        ref={btnRef}
                        data-scale-btn
                        onClick={handleOpen}
                        className="bg-[#020C1B] border border-white/[0.06] rounded-2xl px-4 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)] text-xs font-mono flex items-center gap-2 hover:border-[#10B981]/40 transition-colors select-none"
                    >
                        <span className="text-[#10B981] font-bold tracking-tight">{currentScale}</span>
                        <ChevronDown size={12} className={`text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </button>
                </div>,
                document.body
            )}

            {/* Dropdown via portal */}
            {open && createPortal(
                <div
                    data-scale-dropdown
                    className="fixed bg-[#020C1B] border border-white/10 rounded-xl py-1 w-max animate-in fade-in slide-in-from-bottom-2 duration-150 custom-scrollbar"
                    style={{
                        bottom: dropdownPos.bottom,
                        left: dropdownPos.left,
                        zIndex: 99999,
                        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                        maxHeight: '360px',
                        overflowY: 'auto',
                    }}
                >
                    {Object.entries(ZOOM_SCALES).map(([z, denom]) => {
                        const zNum = Number(z)
                        const label = `1 : ${denom.toLocaleString('ru-RU')}`
                        const active = zNum === Math.round(zoom)
                        return (
                            <button
                                key={z}
                                onClick={() => { map.setZoom(zNum); setOpen(false) }}
                                className={`w-full text-left px-4 py-1.5 text-[10px] font-mono transition-colors flex items-center gap-3 ${
                                    active
                                        ? 'text-[#10B981] bg-[#10B981]/5'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-[#10B981]'
                                }`}
                            >
                                <span className={`text-[9px] font-bold w-4 text-right ${active ? 'text-[#10B981]' : 'text-slate-600'}`}>{z}</span>
                                <span>{label}</span>
                            </button>
                        )
                    })}
                </div>,
                document.body
            )}

            {/* Coordinates pill — portal, bottom right of map */}
            {mouseCoords && createPortal(
                <div
                    className="pointer-events-none select-none bg-[#020C1B] border border-white/[0.06] rounded-2xl px-4 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)] text-xs font-mono text-slate-400 flex items-center gap-2"
                    style={{ position: 'fixed', bottom: pillPos.bottom, right: pillPos.right, zIndex: 6000 }}
                >
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Lat</span>
                    <span className="text-white/90">{Math.abs(mouseCoords.lat).toFixed(6)}°{latDir}</span>
                    <span className="text-white/10 mx-1">|</span>
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Lon</span>
                    <span className="text-white/90">{Math.abs(mouseCoords.lng).toFixed(6)}°{lngDir}</span>
                </div>,
                document.body
            )}
        </>
    )
}
