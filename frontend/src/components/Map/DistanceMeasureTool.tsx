import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

interface DistanceMeasureToolProps {
    active: boolean
    accentColor?: string
}

function formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} м`
    return `${(meters / 1000).toFixed(2)} км`
}

export default function DistanceMeasureTool({ active, accentColor = '#10B981' }: DistanceMeasureToolProps) {
    const map = useMap()
    const pointsRef = useRef<L.LatLng[]>([])
    const markersRef = useRef<L.CircleMarker[]>([])
    const lineRef = useRef<L.Polyline | null>(null)
    const summaryRef = useRef<L.Marker | null>(null)

    const clearMeasure = () => {
        pointsRef.current = []

        if (lineRef.current) {
            map.removeLayer(lineRef.current)
            lineRef.current = null
        }

        if (summaryRef.current) {
            map.removeLayer(summaryRef.current)
            summaryRef.current = null
        }

        markersRef.current.forEach((marker) => map.removeLayer(marker))
        markersRef.current = []
    }

    useEffect(() => {
        if (!active) {
            clearMeasure()
            map.getContainer().style.cursor = ''
            map.doubleClickZoom.enable()
            return
        }

        const onClick = (e: L.LeafletMouseEvent) => {
            pointsRef.current.push(e.latlng)

            const marker = L.circleMarker(e.latlng, {
                radius: 5,
                color: accentColor,
                fillColor: accentColor,
                fillOpacity: 1,
                weight: 1,
            }).addTo(map)
            markersRef.current.push(marker)

            if (lineRef.current) {
                lineRef.current.setLatLngs(pointsRef.current)
            } else {
                lineRef.current = L.polyline(pointsRef.current, {
                    color: accentColor,
                    weight: 3,
                    dashArray: '7,6',
                }).addTo(map)
            }

            if (pointsRef.current.length >= 2) {
                let totalDistance = 0
                for (let i = 1; i < pointsRef.current.length; i += 1) {
                    totalDistance += map.distance(pointsRef.current[i - 1], pointsRef.current[i])
                }

                const lastPoint = pointsRef.current[pointsRef.current.length - 1]
                const label = `Дистанция: ${formatDistance(totalDistance)}`

                if (summaryRef.current) {
                    summaryRef.current.setLatLng(lastPoint)
                    summaryRef.current.setIcon(
                        L.divIcon({
                            className: '',
                            html: `<div style="background: rgba(2,12,27,0.85); border: 1px solid rgba(255,255,255,0.18); color: ${accentColor}; border-radius: 10px; padding: 4px 8px; font-size: 11px; font-weight: 700; white-space: nowrap;">${label}</div>`,
                        })
                    )
                } else {
                    summaryRef.current = L.marker(lastPoint, {
                        icon: L.divIcon({
                            className: '',
                            html: `<div style="background: rgba(2,12,27,0.85); border: 1px solid rgba(255,255,255,0.18); color: ${accentColor}; border-radius: 10px; padding: 4px 8px; font-size: 11px; font-weight: 700; white-space: nowrap;">${label}</div>`,
                        }),
                    }).addTo(map)
                }
            }
        }

        const onContextMenu = () => {
            clearMeasure()
        }

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') clearMeasure()
        }

        map.getContainer().style.cursor = 'crosshair'
        map.doubleClickZoom.disable()
        map.on('click', onClick)
        map.on('contextmenu', onContextMenu)
        window.addEventListener('keydown', onKeyDown)

        return () => {
            map.off('click', onClick)
            map.off('contextmenu', onContextMenu)
            window.removeEventListener('keydown', onKeyDown)
            map.getContainer().style.cursor = ''
            map.doubleClickZoom.enable()
            clearMeasure()
        }
    }, [active, map, accentColor])

    return null
}
