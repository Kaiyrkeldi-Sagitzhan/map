/**
 * MapEditor.tsx — Main workspace for the map editor.
 * Three-panel design: Left (Layers), Center (Map), Right (Properties).
 * Bottom: floating toolbar pill + coordinate display.
 */
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { apiService } from '../../services/api'
import { useEditorStore } from '../../store/editorStore'
import Toolbar from './Toolbar'
import LayersPanel from './LayersPanel'
import PropertiesPanel from './PropertiesPanel'
import CoordinateDisplay from './CoordinateDisplay'
import GeomanController from './GeomanController'
import SearchResults from './SearchResults'
import TextSearch from './TextSearch'
import VectorTileLayer from '../Map/VectorTileLayer'
import DistanceMeasureTool from '../Map/DistanceMeasureTool'

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Component to handle initial "Fly To" animation and register map instance
const MapStateTracker = () => {
    const map = useMap()
    const animated = useRef(false)

    useEffect(() => {
        // Register map globally for Toolbar access
        ;(window as any).leafletMap = map

        // Restore view from localStorage if exists
        const savedView = localStorage.getItem('map-view')
        if (savedView) {
            try {
                const { lat, lng, zoom } = JSON.parse(savedView)
                map.setView([lat, lng], zoom)
                animated.current = true // Skip initial flyTo if we have a saved view
            } catch (e) {
                console.error('Failed to restore map view', e)
            }
        }

        if (!animated.current) {
            // Smoothly focus on Kazakhstan
            setTimeout(() => {
                map.flyTo([48.0196, 66.9237], 5, {
                    duration: 2.0,
                    easeLinearity: 0.2
                })
                animated.current = true
            }, 500)
        }
    }, [map])

    // Auto-select object from URL param (?objectId=xxx) — used by admin complaint navigation
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const objectId = params.get('objectId')
        if (!objectId) return

        const selectObject = async () => {
            try {
                const obj = await apiService.getGeoObjectById(objectId)
                if (!obj) return

                useEditorStore.getState().setSelectedFeatureById(objectId)
                useEditorStore.getState().setTool('history')

                // Fly to the object
                const layer = L.geoJSON(
                    { type: 'Feature', properties: {}, geometry: obj.geometry } as any
                )
                const bounds = layer.getBounds()
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 })
                }
            } catch (err) {
                console.error('Failed to load object from URL:', err)
            }
            window.history.replaceState({}, '', window.location.pathname)
        }

        setTimeout(selectObject, 500)
    }, [map])

    // Save view to localStorage on every move/zoom
    useEffect(() => {
        const handleMove = () => {
            const center = map.getCenter()
            const zoom = map.getZoom()
            localStorage.setItem('map-view', JSON.stringify({
                lat: center.lat,
                lng: center.lng,
                zoom
            }))
        }
        map.on('moveend', handleMove)
        map.on('zoomend', handleMove)
        return () => {
            map.off('moveend', handleMove)
            map.off('zoomend', handleMove)
        }
    }, [map])

    return null
}

const MapEditor = () => {
    const showMap = useEditorStore((s) => s.showMap)
    const mapOpacity = useEditorStore((s) => s.mapOpacity)
    const currentTool = useEditorStore((s) => s.currentTool)

    return (
        <div className="flex h-full w-full overflow-hidden bg-[#010814] text-white font-sans selection:bg-[#10B981]/30">
            {/* Left Sidebar: Layers */}
            <LayersPanel />

            {/* Center: Map Area */}
            <main className="relative flex-1 bg-[#010814]">
                <MapContainer
                    center={[30.0, 66.9237]}
                    zoom={3}
                    className="h-full w-full outline-none z-0"
                    style={{ background: '#010814' }}
                    zoomControl={false}
                    minZoom={3}
                    maxZoom={18}
                    preferCanvas={true}
                >
                    <MapStateTracker />
                    <TileLayer
                        url="https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                        opacity={showMap ? mapOpacity : 0}
                    />

                    <VectorTileLayer />
                    <GeomanController />
                    <DistanceMeasureTool active={currentTool === 'measure'} />
                    <TextSearch />

                    <CoordinateDisplay />
                </MapContainer>

                {/* Overlays (Zustand based) */}
                <Toolbar />
                <SearchResults />
            </main>

            {/* Right Sidebar: Properties */}
            <PropertiesPanel />
        </div>
    )
}

export default MapEditor
