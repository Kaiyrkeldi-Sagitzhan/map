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

// Component to handle initial "Fly To" animation
const GlobeAnimator = () => {
    const map = useMap()
    const animated = useRef(false)

    useEffect(() => {
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

    return null
}

const MapEditor = () => {
    const showMap = useEditorStore((s) => s.showMap)
    const mapOpacity = useEditorStore((s) => s.mapOpacity)
    const isLoading = useEditorStore((s) => s.isLoading)

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
                    <GlobeAnimator />
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

                {/* Loading overlay */}
                {isLoading && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-200 flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">Loading objects...</span>
                    </div>
                )}

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
