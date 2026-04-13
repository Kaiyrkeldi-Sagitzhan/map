/**
 * CoordinateDisplay.tsx — Bottom-right mouse coordinate indicator.
 * Shows Lat/Lon in WGS84 (EPSG:4326) with 6 decimal places.
 */
import { useEditorStore } from '../../store/editorStore'

export default function CoordinateDisplay() {
    const mouseCoords = useEditorStore((s) => s.mouseCoords)

    if (!mouseCoords) return null

    const latDir = mouseCoords.lat >= 0 ? 'N' : 'S'
    const lngDir = mouseCoords.lng >= 0 ? 'E' : 'W'

    return (
        <div className="absolute bottom-4 right-4 z-[1000] bg-[#020C1B]/80 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/[0.06] text-xs font-mono text-slate-400 select-none pointer-events-none">
            <span className="text-slate-500">Lat</span>{' '}
            <span className="text-white/90">{Math.abs(mouseCoords.lat).toFixed(6)}°{latDir}</span>
            <span className="text-white/10 mx-2">|</span>
            <span className="text-slate-500">Lon</span>{' '}
            <span className="text-white/90">{Math.abs(mouseCoords.lng).toFixed(6)}°{lngDir}</span>
        </div>
    )
}
