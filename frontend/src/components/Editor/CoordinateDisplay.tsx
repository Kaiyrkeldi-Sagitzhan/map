/**
 * CoordinateDisplay.tsx
 * Bottom-left: [1:X scale — clickable dropdown via portal]
 * Bottom-right: [Lat / Lon]
 * Must be placed inside MapContainer to use useMap().
 */
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import { useEditorStore } from '../../store/editorStore'
import { ChevronDown } from 'lucide-react'

function computeScale(zoom: number, lat: number): string {
    const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)
    const denom = Math.round(mpp * 3779.5275)
    const mag = Math.pow(10, Math.floor(Math.log10(denom)) - 1)
    const rounded = Math.round(denom / mag) * mag
    return `1 : ${rounded.toLocaleString('ru-RU')}`
}

export default function CoordinateDisplay() {
    const map = useMap()
    const mouseCoords = useEditorStore((s) => s.mouseCoords)
    const [zoom, setZoom] = useState(map.getZoom())
    const [centerLat, setCenterLat] = useState(map.getCenter().lat)
    const [open, setOpen] = useState(false)
    const [dropdownPos, setDropdownPos] = useState({ bottom: 0, left: 0 })
    const btnRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const update = () => {
            setZoom(map.getZoom())
            setCenterLat(map.getCenter().lat)
        }
        map.on('zoomend moveend', update)
        return () => { map.off('zoomend moveend', update) }
    }, [map])

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

    const presets = Array.from({ length: 18 }, (_, i) => i + 1).map((z) => ({
        zoom: z,
        label: computeScale(z, centerLat),
    }))

    const currentScale = computeScale(zoom, centerLat)
    const latDir = mouseCoords ? (mouseCoords.lat >= 0 ? 'N' : 'S') : ''
    const lngDir = mouseCoords ? (mouseCoords.lng >= 0 ? 'E' : 'W') : ''

    return (
        <>
            {/* Scale pill — bottom left */}
            <div className="leaflet-bottom leaflet-left" style={{ marginBottom: '12px', marginLeft: '12px' }}>
                <div className="leaflet-control" style={{ position: 'relative', zIndex: 1000 }}>
                    <button
                        ref={btnRef}
                        data-scale-btn
                        onClick={handleOpen}
                        className="bg-[#020C1B] border border-white/[0.06] rounded-2xl px-4 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)] text-xs font-mono flex items-center gap-2 hover:border-[#10B981]/40 transition-colors select-none"
                    >
                        <span className="text-[#10B981] font-bold tracking-tight">{currentScale}</span>
                        <ChevronDown size={12} className={`text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Dropdown via portal — renders above everything */}
            {open && createPortal(
                <div
                    data-scale-dropdown
                    className="fixed bg-[#020C1B] border border-white/10 rounded-xl py-1 w-max animate-in fade-in slide-in-from-bottom-2 duration-150"
                    style={{
                        bottom: dropdownPos.bottom,
                        left: dropdownPos.left,
                        zIndex: 99999,
                        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                    }}
                >
                    <div>
                        {presets.map((p) => (
                            <button
                                key={p.zoom}
                                onClick={() => { map.setZoom(p.zoom); setOpen(false) }}
                                className={`w-full text-left px-3 py-1 text-[10px] font-mono transition-colors ${
                                    p.zoom === Math.round(zoom)
                                        ? 'text-[#10B981] bg-[#10B981]/5'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-[#10B981]'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}

            {/* Coordinates pill — bottom right */}
            {mouseCoords && (
                <div className="leaflet-bottom leaflet-right" style={{ marginBottom: '12px', marginRight: '12px' }}>
                    <div className="leaflet-control pointer-events-none select-none bg-[#020C1B] border border-white/[0.06] rounded-2xl px-4 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)] text-xs font-mono text-slate-400 flex items-center gap-2">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Lat</span>
                        <span className="text-white/90">{Math.abs(mouseCoords.lat).toFixed(6)}°{latDir}</span>
                        <span className="text-white/10 mx-1">|</span>
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Lon</span>
                        <span className="text-white/90">{Math.abs(mouseCoords.lng).toFixed(6)}°{lngDir}</span>
                    </div>
                </div>
            )}
        </>
    )
}
