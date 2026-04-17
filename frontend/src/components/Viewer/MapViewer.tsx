/**
 * MapViewer.tsx — Read-only map viewer for regular users.
 * Click handling uses direct map.on() (NOT useMapEvents) to match editor pattern.
 * Search area uses Geoman (same as editor) for reliable polygon/rectangle drawing.
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { MapContainer, TileLayer, ScaleControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

import { apiService } from '../../services/api'
import { useViewerStore } from '../../store/viewerStore'
import { getAdvancedStyle } from '../../types/editor'

import ViewerLayersPanel from './ViewerLayersPanel'
import ViewerPropertiesPanel from './ViewerPropertiesPanel'
import ViewerCoordinateDisplay from './ViewerCoordinateDisplay'
import ViewerTextSearch from './ViewerTextSearch'
import ViewerToolbar from './ViewerToolbar'
import ComplaintModal from './ComplaintModal'
import VectorTileLayer from '../Map/VectorTileLayer'
import ZoomPicker from '../Editor/ZoomPicker'
import ViewerSearchResults from './ViewerSearchResults'
import DistanceMeasureTool from '../Map/DistanceMeasureTool'

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const GEOMAN_DRAW_OPTIONS = {
    pathOptions: {
        color: '#10B981',
        fillColor: 'transparent',
        fillOpacity: 0,
        weight: 2,
    },
}

const MapStateTracker = ({ onComplaintPick }: { onComplaintPick: (feature: any) => void }) => {
    const map = useMap()
    const animated = useRef(false)
    const setMouseCoords = useViewerStore((s) => s.setMouseCoords)
    const { activeTool, setSelectedFeature, toggleSelectedFeature, fetchFeatureHistory, setActiveTool, setHighlight } = useViewerStore()
    const clearSelection = useViewerStore((s) => s.clearSelection)

    // Refs for latest values (avoid re-registering event handlers)
    const activeToolRef = useRef(activeTool)
    useEffect(() => { activeToolRef.current = activeTool }, [activeTool])

    const onComplaintPickRef = useRef(onComplaintPick)
    useEffect(() => { onComplaintPickRef.current = onComplaintPick }, [onComplaintPick])

    // Shift key tracking for Polygon vs Rectangle in search area
    const isShiftHeld = useRef(false)
    const lastForwardedFeatureClickAt = useRef(0)

    // Helper: convert backend object to ViewerFeature
    const mapObjToFeature = (obj: any) => ({
        id: obj.id,
        backendId: obj.id,
        name: obj.name || 'Объект',
        type: obj.type || 'other',
        description: obj.description || '',
        geometry: obj.geometry,
        metadata: obj.metadata,
        style: (obj.metadata as any)?.style
    })

    // ─── Geoman initialization (once) ───────────────────────
    useEffect(() => {
        if (!map || !(map as any).pm) return
        map.pm.setGlobalOptions({
            snappable: false,
            allowSelfIntersection: false,
            templineStyle: { color: '#10B981', weight: 2 },
            hintlineStyle: { color: '#10B981', weight: 2, dashArray: '5,5' },
            pathOptions: GEOMAN_DRAW_OPTIONS.pathOptions,
        })
        // Hide all Geoman toolbar buttons — viewer has its own toolbar
        map.pm.addControls({
            position: 'topleft',
            drawMarker: false, drawCircle: false, drawCircleMarker: false,
            drawPolyline: false, drawRectangle: false, drawPolygon: false,
            drawText: false, editMode: false, dragMode: false,
            cutPolygon: false, removalMode: false, rotateMode: false,
        })
        // Hide Geoman toolbar container entirely via CSS
        const toolbar = map.getContainer().querySelector('.leaflet-pm-toolbar')
        if (toolbar) (toolbar as HTMLElement).style.display = 'none'
    }, [map])

    // ─── Search: perform bounds search with type filter ─────
    const performBoundsSearch = useCallback(async (bounds: L.LatLngBounds) => {
        const zoom = map.getZoom()
        const { featureClassFilter, searchAreaLayers } = useViewerStore.getState()
        const selectedLayers = Array.from(searchAreaLayers)
        try {
            if (selectedLayers.length === 0) {
                useViewerStore.getState().setSearchResults([])
                setActiveTool('select')
                return
            }

            const requestBounds = {
                minLat: bounds.getSouth(), minLng: bounds.getWest(),
                maxLat: bounds.getNorth(), maxLng: bounds.getEast(),
                zoom, filterByZoom: false
            } as any

            const responses = await Promise.all(
                selectedLayers.map((layerType) => apiService.getGeoObjects(layerType || featureClassFilter || undefined, requestBounds))
            )

            const byId = new Map<string, any>()
            for (const res of responses) {
                for (const obj of (res.objects || [])) {
                    byId.set(obj.id, obj)
                }
            }

            const results = Array.from(byId.values()).map(mapObjToFeature)
            useViewerStore.getState().setSearchResults(results)
            setActiveTool('select')
        } catch (err) { console.error('Search failed:', err) }
    }, [map, setActiveTool])

    // ─── Geoman pm:create handler ───────────────────────────
    useEffect(() => {
        if (!map || !(map as any).pm) return
        const onPmCreate = async (e: any) => {
            const layer = e.layer as L.Layer
            const bounds = (layer as L.Polygon).getBounds()
            map.removeLayer(layer)
            await performBoundsSearch(bounds)
        }
        map.on('pm:create', onPmCreate)
        return () => { map.off('pm:create', onPmCreate) }
    }, [map, performBoundsSearch])

    // ─── Activate/deactivate Geoman draw mode ───────────────
    useEffect(() => {
        if (!map || !(map as any).pm) return

        if (activeTool === 'searchArea') {
            const mode = isShiftHeld.current ? 'Rectangle' : 'Polygon'
            map.pm.enableDraw(mode as any, GEOMAN_DRAW_OPTIONS)
            map.doubleClickZoom.disable()
            map.getContainer().style.cursor = 'crosshair'
        } else {
            map.pm.disableDraw()
            map.doubleClickZoom.enable()
            if (map.getContainer()) map.getContainer().style.cursor = ''
        }

        return () => {
            map.pm.disableDraw()
            if (map.getContainer()) {
                map.getContainer().style.cursor = ''
            }
            map.doubleClickZoom.enable()
        }
    }, [map, activeTool])

    // ─── Shift key: toggle Polygon ↔ Rectangle in search area
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                isShiftHeld.current = true
                if (activeToolRef.current === 'searchArea' && (map as any).pm) {
                    map.pm.disableDraw()
                    map.pm.enableDraw('Rectangle' as any, GEOMAN_DRAW_OPTIONS)
                }
            }
            if (e.key === 'Escape' && activeToolRef.current === 'searchArea' && (map as any).pm) {
                map.pm.disableDraw()
                map.pm.enableDraw('Polygon' as any, GEOMAN_DRAW_OPTIONS)
            }
        }
        const up = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                isShiftHeld.current = false
                if (activeToolRef.current === 'searchArea' && (map as any).pm) {
                    map.pm.disableDraw()
                    map.pm.enableDraw('Polygon' as any, GEOMAN_DRAW_OPTIONS)
                }
            }
        }
        window.addEventListener('keydown', down)
        window.addEventListener('keyup', up)
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
    }, [map])

    // ─── ESC to deselect current object ────────────────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (activeToolRef.current === 'searchArea') return // Geoman handles ESC
                clearSelection()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [clearSelection])

    // ─── Pick object: direct ID if available, bbox fallback (like editor) ──
    const pickObject = useCallback(async (latlng: L.LatLng, featureProps?: any, additiveSelect = false) => {
        let obj: any = null

        try {
            // Fast path: direct ID from vector tile click
            if (featureProps?.id) {
                console.log('[MapViewer] pickObject by ID:', featureProps.id)
                obj = await apiService.getGeoObjectById(featureProps.id)
            }

            // Fallback: bbox search (same as editor useGeoman.ts:177-189)
            if (!obj) {
                const zoom = map.getZoom()
                const delta = Math.max(0.0001, 2.0 / Math.pow(2, zoom))
                const typeFilter = useViewerStore.getState().featureClassFilter
                console.log('[MapViewer] pickObject by bbox, delta=', delta, 'filter=', typeFilter)
                const res = await apiService.getGeoObjects(typeFilter || undefined, {
                    minLat: latlng.lat - delta,
                    minLng: latlng.lng - delta,
                    maxLat: latlng.lat + delta,
                    maxLng: latlng.lng + delta,
                    zoom,
                    filterByZoom: false,
                } as any)
                if (res.objects && res.objects.length > 0) {
                    obj = res.objects[0]
                }
            }

            if (!obj) return

            const viewerFeature = mapObjToFeature(obj)

            if (activeToolRef.current === 'complaint') {
                setSelectedFeature(viewerFeature)
                setHighlight(viewerFeature.geometry, {
                    color: '#ff4500', fillColor: '#ff4500', weight: 4, fillOpacity: 0.25,
                })
                onComplaintPickRef.current(viewerFeature)
                return
            }

            if (additiveSelect) {
                toggleSelectedFeature(viewerFeature)
            } else {
                setSelectedFeature(viewerFeature)
            }
            setHighlight(viewerFeature.geometry, {
                color: '#ff4500', fillColor: '#ff4500', weight: 4, fillOpacity: 0.25,
            })
            if (activeToolRef.current === 'history') {
                await fetchFeatureHistory(obj.id)
            }
        } catch (err) {
            console.error('Viewer Pick failed:', err)
        }
    }, [map, setSelectedFeature, toggleSelectedFeature, fetchFeatureHistory, setHighlight])

    // ─── Unified click + mousemove via direct map.on() ──────
    // This is the same pattern as editor's useGeoman.ts (line 254-282).
    // VectorTileLayer forwards clicks via map.fireEvent('click') → arrives here.
    useEffect(() => {
        if (!map) return

        const onMouseMove = (e: L.LeafletMouseEvent) => {
            setMouseCoords({ lat: e.latlng.lat, lng: e.latlng.lng })
        }

        const onClick = (e: any) => {
            const tool = activeToolRef.current
            // Geoman handles searchArea clicks internally — do not intercept
            if (tool === 'searchArea' || tool === 'measure') return

            // Skip duplicate native map click after vector-tile forwarded click.
            // In some browsers originalEvent marker is not reliably preserved.
            const now = Date.now()
            if (e.featureProperties) {
                lastForwardedFeatureClickAt.current = now
            } else if (now - lastForwardedFeatureClickAt.current < 250) {
                return
            }

            // Extra guard when originalEvent marker is present.
            if (!e.featureProperties && e.originalEvent?._featureHandled) return

            // History, complaint, select — pick object (ID fast path + bbox fallback)
            if (tool === 'select' || tool === 'history' || tool === 'complaint') {
                const isShiftSelect = !!(e.originalEvent as MouseEvent | undefined)?.shiftKey || isShiftHeld.current
                pickObject(e.latlng, e.featureProperties, isShiftSelect && (tool === 'select' || tool === 'history'))
            }
        }

        map.on('mousemove', onMouseMove)
        map.on('click', onClick)

        return () => {
            map.off('mousemove', onMouseMove)
            map.off('click', onClick)
        }
    }, [map, pickObject, setMouseCoords])

    // ─── Auto-select object from URL param (?objectId=xxx) ──
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const objectId = params.get('objectId')
        if (!objectId) return

        const selectObject = async () => {
            try {
                const obj = await apiService.getGeoObjectById(objectId)
                if (!obj) return

                const viewerFeature = mapObjToFeature(obj)
                setSelectedFeature(viewerFeature)
                setHighlight(viewerFeature.geometry, {
                    color: '#ff4500', fillColor: '#ff4500', weight: 4, fillOpacity: 0.25,
                })
                await fetchFeatureHistory(obj.id)

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
            // Clean URL param
            window.history.replaceState({}, '', window.location.pathname)
        }

        setTimeout(selectObject, 500)
    }, [map, setSelectedFeature, setHighlight, fetchFeatureHistory])

    // ─── Map init: restore saved view or animate ────────────
    useEffect(() => {
        ;(window as any).leafletMap = map
        ;(window as any).L = L
        const savedView = localStorage.getItem('map-view')
        if (savedView) {
            try {
                const { lat, lng, zoom } = JSON.parse(savedView)
                map.setView([lat, lng], zoom)
                animated.current = true
            } catch (e) { console.error(e) }
        }
        if (!animated.current) {
            setTimeout(() => {
                map.flyTo([48.0196, 66.9237], 5, { duration: 2.0, easeLinearity: 0.2 })
                animated.current = true
            }, 500)
        }
    }, [map])

    // ─── Persist view to localStorage ───────────────────────
    useEffect(() => {
        const handleMove = () => {
            const center = map.getCenter()
            const zoom = map.getZoom()
            localStorage.setItem('map-view', JSON.stringify({ lat: center.lat, lng: center.lng, zoom }))
        }
        map.on('moveend', handleMove)
        map.on('zoomend', handleMove)
        return () => { map.off('moveend', handleMove); map.off('zoomend', handleMove) }
    }, [map])

    return null
}

/** Renders highlightGeometry from viewerStore as a GeoJSON overlay */
const HighlightOverlay = () => {
    const map = useMap()
    const layerRef = useRef<L.GeoJSON | null>(null)
    const highlightGeometry = useViewerStore((s) => s.highlightGeometry)
    const highlightStyle = useViewerStore((s) => s.highlightStyle)

    useEffect(() => {
        if (layerRef.current) {
            map.removeLayer(layerRef.current as any)
            layerRef.current = null
        }
        if (!highlightGeometry) return

        const style = highlightStyle || {
            color: '#ff4500',
            fillColor: '#ff4500',
            weight: 4,
            fillOpacity: 0.25,
        }

        const geoJsonLayer = L.geoJSON(
            { type: 'Feature', properties: {}, geometry: highlightGeometry } as any,
            { style: () => style }
        ).addTo(map)

        layerRef.current = geoJsonLayer

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current as any)
                layerRef.current = null
            }
        }
    }, [map, highlightGeometry, highlightStyle])

    return null
}

/** Renders searchResults from viewerStore as GeoJSON layers on the map (like editor's useGeoman.ts:79-138) */
const SearchResultsOverlay = () => {
    const map = useMap()
    const layersRef = useRef<L.Layer[]>([])
    const isShiftHeldRef = useRef(false)
    const searchResults = useViewerStore((s) => s.searchResults)
    const setSelectedFeature = useViewerStore((s) => s.setSelectedFeature)
    const toggleSelectedFeature = useViewerStore((s) => s.toggleSelectedFeature)
    const setHighlight = useViewerStore((s) => s.setHighlight)
    const fetchFeatureHistory = useViewerStore((s) => s.fetchFeatureHistory)
    const activeTool = useViewerStore((s) => s.activeTool)
    const visibleLayers = useViewerStore((s) => s.visibleLayers)

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'Shift') isShiftHeldRef.current = true
        }
        const up = (e: KeyboardEvent) => {
            if (e.key === 'Shift') isShiftHeldRef.current = false
        }
        window.addEventListener('keydown', down)
        window.addEventListener('keyup', up)
        return () => {
            window.removeEventListener('keydown', down)
            window.removeEventListener('keyup', up)
        }
    }, [])

    useEffect(() => {
        // Cleanup old layers
        layersRef.current.forEach(l => map.removeLayer(l))
        layersRef.current = []

        if (searchResults.length === 0) return

        searchResults.forEach(f => {
            if (!visibleLayers.has(f.type)) return
            const style = getAdvancedStyle(f.type as any, f.metadata)
            const isLine = f.type === 'road' || f.type === 'river'

            const geoLayer = L.geoJSON(
                { type: 'Feature', properties: {}, geometry: f.geometry } as any,
                {
                    style: () => ({
                        color: style.color,
                        fillColor: isLine ? 'transparent' : style.fillColor,
                        fillOpacity: isLine ? 0 : style.fillOpacity,
                        weight: Math.max(style.weight, 2),
                        fill: !isLine,
                        dashArray: style.dashArray,
                    }),
                    pointToLayer: (_: any, latlng: any) => {
                        return L.circleMarker(latlng, {
                            radius: 6, color: style.color, fillColor: style.fillColor,
                            fillOpacity: 0.8, weight: 2,
                        })
                    }
                } as any
            )

            geoLayer.eachLayer(l => {
                l.on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e)
                    const isShiftSelect = !!(e.originalEvent as MouseEvent | undefined)?.shiftKey || isShiftHeldRef.current
                    if (isShiftSelect) {
                        toggleSelectedFeature(f)
                    } else {
                        setSelectedFeature(f)
                    }
                    setHighlight(f.geometry, {
                        color: '#ff4500', fillColor: '#ff4500', weight: 4, fillOpacity: 0.25,
                    })
                    if (activeTool === 'history') {
                        fetchFeatureHistory(f.backendId || f.id)
                    }
                })
                l.addTo(map)
                layersRef.current.push(l)
            })
        })

        return () => {
            layersRef.current.forEach(l => map.removeLayer(l))
            layersRef.current = []
        }
    }, [map, searchResults, visibleLayers, setSelectedFeature, toggleSelectedFeature, setHighlight, fetchFeatureHistory, activeTool])

    return null
}

const MapViewer = () => {
    const showMap = useViewerStore((s) => s.showMap)
    const mapOpacity = useViewerStore((s) => s.mapOpacity)
    const activeTool = useViewerStore((s) => s.activeTool)
    const [complaintTarget, setComplaintTarget] = useState<any>(null)

    return (
        <div className="flex h-full w-full overflow-hidden bg-[#010814] text-white font-sans selection:bg-[#10B981]/30">
            {/* Left panel: History */}
            <ViewerLayersPanel />

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
                    <MapStateTracker onComplaintPick={setComplaintTarget} />
                    <TileLayer
                        url="https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                        opacity={showMap ? mapOpacity : 0}
                    />
                    <VectorTileLayer />
                    <HighlightOverlay />
                    <SearchResultsOverlay />
                    <DistanceMeasureTool active={activeTool === 'measure'} accentColor="#f59e0b" />
                    <ViewerTextSearch />
                    <ScaleControl position="bottomleft" />
                    <ZoomPicker />
                </MapContainer>

                <ViewerToolbar />
                <ViewerCoordinateDisplay />
                <ViewerSearchResults />
            </main>

            {/* Right panel: Properties */}
            <ViewerPropertiesPanel />

            {complaintTarget && (
                <ComplaintModal
                    onClose={() => setComplaintTarget(null)}
                    initialData={complaintTarget}
                />
            )}
        </div>
    )
}

export default MapViewer
