/**
 * MapEditor.tsx — Main workspace for the map editor.
 * Three-panel design: Left (Layers), Center (Map), Right (Properties).
 * Bottom: floating toolbar pill + coordinate display.
 */
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, ScaleControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { useEditorStore } from '../../store/editorStore'
import Toolbar from './Toolbar'
import LayersPanel from './LayersPanel'
import PropertiesPanel from './PropertiesPanel'
import CoordinateDisplay from './CoordinateDisplay'
import GeomanController from './GeomanController'
import SearchResults from './SearchResults'
import TextSearch from './TextSearch'
import ZoomPicker from './ZoomPicker'
import VectorTileLayer from '../Map/VectorTileLayer'

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

    return (
        <div className="flex h-full w-full overflow-hidden bg-gray-50 text-gray-900 font-sans">
            {/* Left Sidebar: Layers */}
            <LayersPanel />

            {/* Center: Map Area */}
            <main className={`relative flex-1 ${!showMap ? 'bg-[#fcfcfc]' : 'bg-white'}`}>
                <MapContainer
                    center={[30.0, 66.9237]} // Slightly south for a "coming from below" feel
                    zoom={3}
                    className="h-full w-full outline-none bg-[#f2efe9]"
                    zoomControl={false}
                    minZoom={3}
                    maxZoom={20}
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
                    <TextSearch />

                    {/* Visual enhancements */}
                    <ScaleControl position="bottomleft" />
                    <ZoomPicker />
                </MapContainer>

                {/* Overlays (Zustand based) */}
                <Toolbar />
                <CoordinateDisplay />
                <SearchResults />
            </main>

            {/* Right Sidebar: Properties */}
            <PropertiesPanel />
        </div>
    )
}

export default MapEditor
