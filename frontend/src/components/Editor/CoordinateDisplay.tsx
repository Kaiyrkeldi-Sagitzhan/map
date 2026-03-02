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
        <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 backdrop-blur-md rounded-lg px-3 py-1.5 shadow-lg border border-gray-200/60 text-xs font-mono text-gray-600 select-none pointer-events-none">
            <span className="text-gray-400">Широта</span>{' '}
            <span className="text-gray-800">{Math.abs(mouseCoords.lat).toFixed(6)}° {latDir}</span>
            <span className="text-gray-300 mx-1.5">|</span>
            <span className="text-gray-400">Долгота</span>{' '}
            <span className="text-gray-800">{Math.abs(mouseCoords.lng).toFixed(6)}° {lngDir}</span>
        </div>
    )
}
