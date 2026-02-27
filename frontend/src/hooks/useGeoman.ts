/**
 * useGeoman — custom hook integrating leaflet-geoman with the Zustand editor store.
 * Handles draw mode activation, event listeners, and feature sync.
 */
import { useEffect, useRef, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { useEditorStore } from '../store/editorStore'
import { CLASS_STYLES, getSafeStyle } from '../types/editor'
import type { DrawTool, EditorFeature } from '../types/editor'
import { apiService } from '../services/api'

/** Map DrawTool → geoman draw mode string */
function toolToGeomanMode(tool: DrawTool, isShiftHeld: boolean = false): string | null {
    switch (tool) {
        case 'drawPolygon': return 'Polygon'
        case 'drawRectangle': return 'Rectangle'
        case 'drawCircle': return 'Circle'
        case 'drawLine': return 'Line'
        case 'freehand': return 'Polygon' // freehand uses polygon mode with freehand option
        case 'marker': return 'Marker'
        case 'searchArea': return isShiftHeld ? 'Rectangle' : 'Polygon'
        default: return null
    }
}

export function useGeoman() {
    const map = useMap()
    const prevTool = useRef<DrawTool>('select')
    const layerToFeatureId = useRef<Map<L.Layer, string>>(new Map())
    const featureIdToLayer = useRef<Map<string, L.Layer>>(new Map())
    const isShiftHeld = useRef(false)

    const {
        currentTool,
        featureClass,
        features,
        searchResults,
        selectedFeatureId,
        addFeature,
        updateFeature,
        deleteFeature,
        setSelectedFeature,
        setMouseCoords,
    } = useEditorStore()

    const searchLayers = useRef<L.Layer[]>([])

    // ─── Track Shift key for searchArea mode ─────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') isShiftHeld.current = true
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') isShiftHeld.current = false
        }
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [])

    // ─── Sync search results to map ──────────────────────────
    useEffect(() => {
        if (!map) return

        // Clear old search layers
        searchLayers.current.forEach(l => map.removeLayer(l))
        searchLayers.current = []

        // Add search results as temporary layers
        searchResults.forEach(f => {
            const isLine = f.featureClass === 'road' || 
                           f.featureClass === 'river' || 
                           f.geometry.type === 'LineString' || 
                           f.geometry.type === 'MultiLineString'
            
            const layer = L.geoJSON(
                { type: 'Feature', properties: {}, geometry: f.geometry } as GeoJSON.Feature,
                {
                    style: () => ({
                        color: f.style.color,
                        fillColor: isLine ? 'transparent' : f.style.fillColor,
                        fillOpacity: isLine ? 0 : 1, 
                        weight: f.style.weight,
                        fill: !isLine
                    })
                }
            )

            layer.eachLayer(l => {
                l.on('click', (e) => {
                   L.DomEvent.stopPropagation(e)
                   // When clicking a search result, maybe ask if user wants to add it to project
                   if (confirm(`Добавить "${f.name}" в проект?`)) {
                       addFeature({ ...f, id: crypto.randomUUID() })
                       // Save to backend
                       saveFeatureToBackend({ ...f, id: crypto.randomUUID() })
                   }
                })
                l.addTo(map)
                searchLayers.current.push(l)
            })
        })
    }, [map, searchResults])

    // ─── Initialize geoman ──────────────────────────────────
    useEffect(() => {
        if (!map) return

        // Настраиваем geoman
        map.pm.setGlobalOptions({
            snappable: currentTool !== 'searchArea', // Отключаем магнит при поиске для скорости
            snapDistance: 3, 
            allowSelfIntersection: false,
            templineStyle: { 
                color: currentTool === 'searchArea' ? 'transparent' : '#6366f1', 
                weight: currentTool === 'searchArea' ? 0 : 1.5 
            },
            hintlineStyle: { 
                color: currentTool === 'searchArea' ? 'transparent' : '#6366f1', 
                weight: currentTool === 'searchArea' ? 0 : 1.5, 
                dashArray: '5,5' 
            },
            pathOptions: {
                color: currentTool === 'searchArea' ? '#6366f1' : '#6366f1',
                fillColor: 'transparent', 
                fillOpacity: 0,
                weight: currentTool === 'searchArea' ? 1 : 1.5,
            },
        })

        // Disable default toolbar — we render our own
        map.pm.addControls({
            position: 'topleft',
            drawMarker: false,
            drawCircle: false,
            drawCircleMarker: false,
            drawPolyline: false,
            drawRectangle: false,
            drawPolygon: false,
            drawText: false,
            editMode: false,
            dragMode: false,
            cutPolygon: false,
            removalMode: false,
            rotateMode: false,
        })
    }, [map])

    // ─── Track mouse coords ─────────────────────────────────
    useEffect(() => {
        if (!map) return
        const handler = (e: L.LeafletMouseEvent) => {
            setMouseCoords({ lat: e.latlng.lat, lng: e.latlng.lng })
        }
        map.on('mousemove', handler)
        return () => { map.off('mousemove', handler) }
    }, [map, setMouseCoords])

    // ─── Sync draw mode with currentTool ─────────────────────
    useEffect(() => {
        if (!map) return

        // Disable previous mode
        map.pm.disableDraw()
        map.pm.disableGlobalEditMode()

        if (currentTool === 'select') {
            // Enable edit mode so users can click to select
            map.pm.enableGlobalEditMode({
                allowSelfIntersection: false,
            })
        } else {
            const geomanMode = toolToGeomanMode(currentTool, isShiftHeld.current)
            if (geomanMode) {
                const isSearch = currentTool === 'searchArea'
                const style = CLASS_STYLES[featureClass]

                map.pm.enableDraw(geomanMode as any, {
                    freehandMode: currentTool === 'freehand',
                    pathOptions: {
                        color: isSearch ? 'transparent' : style.color,
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        weight: isSearch ? 0 : style.weight,
                    },
                })
            }
        }

        prevTool.current = currentTool
    }, [map, currentTool, featureClass])

    // ─── Handle pm:create ────────────────────────────────────
    const handleCreate = useCallback(async (e: any) => {
        const layer = e.layer as L.Layer

        if (currentTool === 'searchArea') {
            const bounds = (layer as L.Polygon).getBounds()
            const zoom = map.getZoom()
            const bbox = {
                minLat: bounds.getSouth(),
                minLng: bounds.getWest(),
                maxLat: bounds.getNorth(),
                maxLng: bounds.getEast(),
            }

            // Immediately remove the search polygon from map so it's transparent
            map.removeLayer(layer)

            try {
                // 'custom' filter now acts as "Search All"
                const filter = featureClass === 'custom' ? '' : featureClass
                const res = await apiService.getGeoObjects(filter as any, { ...bbox, zoom, clip: true } as any)
                
                const searchResults: EditorFeature[] = res.objects.map(obj => ({
                    id: crypto.randomUUID(),
                    name: obj.name,
                    featureClass: (obj.type || 'custom') as any,
                    description: obj.description || '',
                    style: (obj.metadata as any)?.style || getSafeStyle(obj.type),
                    visible: true,
                    locked: false,
                    geometry: obj.geometry as GeoJSON.Geometry,
                    backendId: obj.id,
                }))

                // Set search results temporarily
                useEditorStore.getState().setSearchResults(searchResults)
            } catch (err) {
                console.error('Search failed:', err)
            }
            return
        }

        // Standard creation logic
        const geoJson = (layer as any).toGeoJSON() as GeoJSON.Feature
        const style = CLASS_STYLES[featureClass]
        const newFeature: EditorFeature = {
            id: crypto.randomUUID(),
            name: `${featureClass.charAt(0).toUpperCase() + featureClass.slice(1)} ${Date.now().toString(36)}`,
            featureClass,
            description: '',
            style: { ...style },
            visible: true,
            locked: false,
            geometry: geoJson.geometry,
        }

        // Register the leaflet layer ↔ feature mapping
        layerToFeatureId.current.set(layer, newFeature.id)
        featureIdToLayer.current.set(newFeature.id, layer)

        // Style the layer
        if ('setStyle' in layer) {
            (layer as L.Path).setStyle({
                color: style.color,
                fillColor: style.fillColor,
                fillOpacity: style.fillOpacity,
                weight: style.weight,
            })
        }

        // On click → select
        layer.on('click', () => {
            const fid = layerToFeatureId.current.get(layer)
            if (fid) setSelectedFeature(fid)
        })

        addFeature(newFeature)

        // Persist to backend
        saveFeatureToBackend(newFeature)
    }, [currentTool, map, featureClass, addFeature, setSelectedFeature])

    // ─── Handle pm:edit ──────────────────────────────────────
    const handleEdit = useCallback((e: any) => {
        const layer = e.layer as L.Layer
        const fid = layerToFeatureId.current.get(layer)
        if (!fid) return

        const geoJson = (layer as any).toGeoJSON() as GeoJSON.Feature
        updateFeature(fid, { geometry: geoJson.geometry })

        // Persist update
        const feature = useEditorStore.getState().features.find(f => f.id === fid)
        if (feature?.backendId) {
            apiService.updateGeoObject(feature.backendId, {
                geometry: geoJson.geometry,
            }).catch(console.error)
        }
    }, [updateFeature])

    // ─── Handle pm:remove ────────────────────────────────────
    const handleRemove = useCallback((e: any) => {
        const layer = e.layer as L.Layer
        const fid = layerToFeatureId.current.get(layer)
        if (!fid) return

        const feature = useEditorStore.getState().features.find(f => f.id === fid)
        layerToFeatureId.current.delete(layer)
        featureIdToLayer.current.delete(fid)
        deleteFeature(fid)

        // Delete from backend
        if (feature?.backendId) {
            apiService.deleteGeoObject(feature.backendId).catch(console.error)
        }
    }, [deleteFeature])

    // ─── Register event listeners ────────────────────────────
    useEffect(() => {
        if (!map) return
        map.on('pm:create', handleCreate)
        map.on('pm:edit', handleEdit)
        map.on('pm:remove', handleRemove)

        return () => {
            map.off('pm:create', handleCreate)
            map.off('pm:edit', handleEdit)
            map.off('pm:remove', handleRemove)
        }
    }, [map, handleCreate, handleEdit, handleRemove])

    // ─── Load features from backend → leaflet layers ────────
    useEffect(() => {
        if (!map) return

        // Add existing features from store as leaflet layers
        features.forEach((f) => {
            if (featureIdToLayer.current.has(f.id)) return // already on map

            const geoJsonLayer = L.geoJSON(
                { type: 'Feature', properties: {}, geometry: f.geometry } as GeoJSON.Feature,
                {
                    style: () => ({
                        color: f.style.color,
                        fillColor: f.style.fillColor,
                        fillOpacity: f.style.fillOpacity,
                        weight: f.style.weight,
                    }),
                    pointToLayer: (_, latlng) => {
                        return L.circleMarker(latlng, {
                            radius: 8,
                            fillColor: f.style.fillColor,
                            color: f.style.color,
                            weight: f.style.weight,
                            fillOpacity: f.style.fillOpacity,
                        })
                    },
                }
            )

            geoJsonLayer.eachLayer((layer) => {
                layerToFeatureId.current.set(layer, f.id)
                featureIdToLayer.current.set(f.id, layer)

                layer.on('click', () => setSelectedFeature(f.id))

                // Only add visible features
                if (f.visible) {
                    layer.addTo(map)
                }
            })
        })
    }, [map, features, setSelectedFeature])

    // ─── Sync visibility & deletion changes ──────────────────
    useEffect(() => {
        // 1. Remove layers for features that no longer exist
        const currentFeatureIds = new Set(features.map(f => f.id))
        featureIdToLayer.current.forEach((layer, fid) => {
            if (!currentFeatureIds.has(fid)) {
                map.removeLayer(layer)
                featureIdToLayer.current.delete(fid)
                // Also remove from layerToFeatureId map
                layerToFeatureId.current.forEach((_, l) => {
                    if (l === layer) layerToFeatureId.current.delete(l)
                })
            }
        })

        // 2. Sync visibility and styles for existing features
        features.forEach((f) => {
            const layer = featureIdToLayer.current.get(f.id)
            if (!layer) return
            
            if (f.visible && !map.hasLayer(layer)) {
                layer.addTo(map)
            } else if (!f.visible && map.hasLayer(layer)) {
                map.removeLayer(layer)
            }

            // Update style live
            if ('setStyle' in layer) {
                (layer as L.Path).setStyle({
                    color: f.style.color,
                    fillColor: f.style.fillColor,
                    fillOpacity: f.style.fillOpacity,
                    weight: f.style.weight,
                })
            }
        })
    }, [map, features])

    // ─── Highlight selected feature ──────────────────────────
    useEffect(() => {
        featureIdToLayer.current.forEach((layer, fid) => {
            if ('setStyle' in layer) {
                const feature = features.find(f => f.id === fid)
                if (!feature) return
                const isLine = feature.featureClass === 'road' || 
                               feature.featureClass === 'river' ||
                               feature.geometry.type === 'LineString' || 
                               feature.geometry.type === 'MultiLineString'
                
                if (fid === selectedFeatureId) {
                    (layer as L.Path).setStyle({
                        color: '#6366f1', // Indigo outline
                        weight: feature.style.weight + 2,
                        dashArray: '5,5',
                        fillOpacity: isLine ? 0 : feature.style.fillOpacity,
                        fill: !isLine
                    })
                } else {
                    (layer as L.Path).setStyle({
                        color: feature.style.color,
                        weight: feature.style.weight,
                        dashArray: undefined,
                        fillOpacity: feature.style.fillOpacity,
                        fill: !isLine
                    })
                }
            }
        })
    }, [selectedFeatureId, features])

    // ─── Load visible objects from backend ──────────────────
    const loadVisibleObjects = useCallback(async () => {
        if (!map) return
        const store = useEditorStore.getState()
        store.setLoading(true)
        try {
            const bounds = map.getBounds()
            const zoom = map.getZoom()
            const bbox = {
                minLat: bounds.getSouth(),
                minLng: bounds.getWest(),
                maxLat: bounds.getNorth(),
                maxLng: bounds.getEast(),
                zoom,
                clip: true,
                filterByZoom: true,
            }
            const res = await apiService.getGeoObjects('', bbox)
            const existingBackendIds = new Set(
                store.features.filter(f => f.backendId).map(f => f.backendId)
            )
            const newFeatures: EditorFeature[] = res.objects
                .filter(obj => !existingBackendIds.has(obj.id as any))
                .map(obj => ({
                    id: crypto.randomUUID(),
                    name: obj.name,
                    featureClass: (obj.type || 'custom') as any,
                    description: obj.description || '',
                    style: (obj.metadata as any)?.style || getSafeStyle(obj.type),
                    visible: true,
                    locked: false,
                    geometry: obj.geometry as GeoJSON.Geometry,
                    backendId: obj.id as any,
                }))
            newFeatures.forEach(f => store.addFeature(f))
        } catch (err) {
            console.error('Failed to load visible objects:', err)
        } finally {
            store.setLoading(false)
        }
    }, [map])

    return { layerToFeatureId, featureIdToLayer, loadVisibleObjects }
}

// ─── Backend persistence helper ────────────────────────────
async function saveFeatureToBackend(feature: EditorFeature) {
    try {
        const res = await apiService.createGeoObject({
            scope: 'private',
            type: feature.featureClass as any,
            name: feature.name,
            description: feature.description,
            metadata: { style: feature.style },
            geometry: feature.geometry as any,
        })
        // Store the backend ID
        useEditorStore.getState().updateFeature(feature.id, {
            backendId: (res as any).id,
        })
    } catch (err) {
        console.error('Failed to save feature:', err)
    }
}
