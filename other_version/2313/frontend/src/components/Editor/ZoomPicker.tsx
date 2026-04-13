import React, { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const ZoomPicker: React.FC = () => {
    const map = useMap()
    const [zoom, setZoom] = useState(map.getZoom())

    useEffect(() => {
        const onZoom = () => setZoom(map.getZoom())
        map.on('zoomend', onZoom)
        return () => { map.off('zoomend', onZoom) }
    }, [map])

    useEffect(() => {
        const ZoomControl = L.Control.extend({
            onAdd: () => {
                const div = L.DomUtil.create('div', 'leaflet-custom-zoom')
                L.DomEvent.disableClickPropagation(div)
                return div
            }
        })

        const control = new ZoomControl({ position: 'bottomleft' })
        control.addTo(map)

        return () => {
            control.remove()
        }
    }, [map])

    const handleZoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = parseInt(e.target.value, 10)
        map.setZoom(val)
    }

    return (
        <div className="leaflet-bottom leaflet-left" style={{ marginBottom: '45px', marginLeft: '12px', zIndex: 1000 }}>
            <div className="leaflet-control flex items-center gap-2 bg-[#020C1B]/80 backdrop-blur-xl px-3 py-1.5 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/[0.06] pointer-events-auto">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Масштаб</span>
                <select
                    value={Math.round(zoom)}
                    onChange={handleZoomChange}
                    className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer focus:ring-0 [&>option]:bg-[#0A192F] [&>option]:text-white"
                >
                    {Array.from({ length: 16 }, (_, i) => i + 3).map(z => (
                        <option key={z} value={z}>{z}</option>
                    ))}
                </select>
            </div>
        </div>
    )
}

export default ZoomPicker
