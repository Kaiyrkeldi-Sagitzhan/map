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
import { CLASS_STYLES, getSafeStyle, getAdvancedStyle } from '../types/editor'
import type { DrawTool, EditorFeature } from '../types/editor'
import { apiService } from '../services/api'

/** Map DrawTool → geoman draw mode string */
function toolToGeomanMode(tool: DrawTool, isShiftHeld: boolean = false): string | null {
    switch (tool) {
        case 'drawPolygon': return 'Polygon'
        case 'drawRectangle': return 'Rectangle'
        case 'drawCircle': return 'Circle'
        case 'drawLine': return 'Line'
        case 'freehand': return 'Polygon' 
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

    // ─── Track Shift key ─────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') isShiftHeld.current = true }
        const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') isShiftHeld.current = false }
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
        searchLayers.current.forEach(l => map.removeLayer(l))
        searchLayers.current = []

        searchResults.forEach(f => {
            const isLine = f.featureClass === 'road' || f.featureClass === 'river'
            const style = getAdvancedStyle(f.featureClass, f.metadata, f.style)
            const fclass = f.metadata?.fclass || ''

            const layer = L.geoJSON(
                { type: 'Feature', properties: {}, geometry: f.geometry } as GeoJSON.Feature,
                {
                    smoothFactor: 0,
                    style: () => ({
                        color: style.color,
                        fillColor: isLine ? 'transparent' : style.fillColor,
                        fillOpacity: isLine ? 0 : style.fillOpacity, 
                        weight: style.weight,
                        fill: !isLine,
                        dashArray: style.dashArray,
                        noClip: true
                    }),
                    pointToLayer: (_: any, latlng: any) => {
                        let iconHtml = '<div class="w-3 h-3 rounded-full bg-indigo-500 border border-white shadow-sm"></div>'
                        if (fclass === 'hospital' || fclass === 'pharmacy') iconHtml = '🏥'
                        else if (fclass === 'school' || fclass === 'university') iconHtml = '🎓'
                        else if (fclass === 'restaurant' || fclass === 'cafe') iconHtml = '🍴'
                        else if (fclass === 'hotel') iconHtml = '🏨'
                        else if (f.metadata?.population > 100000) iconHtml = `<div class="px-2 py-0.5 bg-white/90 rounded border border-gray-200 text-[10px] font-bold shadow-sm text-black">${f.name}</div>`

                        return L.marker(latlng, {
                            icon: L.divIcon({
                                html: `<div class="flex items-center justify-center">${iconHtml}</div>`,
                                className: '',
                                iconSize: [20, 20]
                            })
                        })
                    }
                } as any
            )

            layer.eachLayer(l => {
                l.on('click', (e) => {
                   L.DomEvent.stopPropagation(e)
                   if (confirm(`Добавить "${f.name}" в проект?`)) {
                       const newF = { ...f, id: crypto.randomUUID() }
                       addFeature(newF)
                       saveFeatureToBackend(newF)
                   }
                })
                l.addTo(map)
                searchLayers.current.push(l)
            })
        })
    }, [map, searchResults, addFeature])

    // ─── Initialize geoman ──────────────────────────────────
    useEffect(() => {
        if (!map) return
        map.pm.setGlobalOptions({
            snappable: currentTool !== 'searchArea',
            snapDistance: 3, 
            allowSelfIntersection: false,
            templineStyle: { color: '#6366f1', weight: 2 },
            hintlineStyle: { color: '#6366f1', weight: 2, dashArray: '5,5' },
            pathOptions: { color: '#6366f1', fillColor: 'transparent', fillOpacity: 0, weight: 2 },
        })
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
    }, [map, currentTool])

    // ─── Track mouse ────────────────────────────────────────
    useEffect(() => {
        if (!map) return
        const handler = (e: L.LeafletMouseEvent) => { setMouseCoords({ lat: e.latlng.lat, lng: e.latlng.lng }) }
        map.on('mousemove', handler)
        return () => { map.off('mousemove', handler) }
    }, [map, setMouseCoords])

    // ─── Sync draw mode ──────────────────────────────────────
    useEffect(() => {
        if (!map) return
        map.pm.disableDraw()
        map.pm.disableGlobalEditMode()

        if (currentTool === 'select') {
            map.pm.enableGlobalEditMode({ allowSelfIntersection: false })
        } else {
            const geomanMode = toolToGeomanMode(currentTool, isShiftHeld.current)
            if (geomanMode) {
                const style = CLASS_STYLES[featureClass]
                map.pm.enableDraw(geomanMode as any, {
                    freehandMode: currentTool === 'freehand',
                    pathOptions: {
                        color: currentTool === 'searchArea' ? '#6366f1' : style.color,
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        weight: currentTool === 'searchArea' ? 1 : style.weight,
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
                minLat: bounds.getSouth(), minLng: bounds.getWest(),
                maxLat: bounds.getNorth(), maxLng: bounds.getEast(),
            }
            map.removeLayer(layer)
            try {
                const filter = featureClass === 'custom' ? '' : featureClass
                const res = await apiService.getGeoObjects(filter as any, { 
                    ...bbox, zoom, clip: false, filterByZoom: false 
                } as any)
                const results: EditorFeature[] = res.objects.map(obj => ({
                    id: crypto.randomUUID(),
                    name: obj.name,
                    featureClass: (obj.type || 'custom') as any,
                    description: obj.description || '',
                    style: (obj.metadata as any)?.style || getSafeStyle(obj.type),
                    visible: true, locked: false,
                    geometry: obj.geometry as GeoJSON.Geometry,
                    backendId: obj.id,
                    metadata: obj.metadata as any,
                }))
                useEditorStore.getState().setSearchResults(results)
            } catch (err) { console.error('Search failed:', err) }
            return
        }

        const geoJson = (layer as any).toGeoJSON() as GeoJSON.Feature
        const style = CLASS_STYLES[featureClass]
        const newFeature: EditorFeature = {
            id: crypto.randomUUID(),
            name: `${featureClass.charAt(0).toUpperCase() + featureClass.slice(1)} ${Date.now().toString(36)}`,
            featureClass, description: '', style: { ...style },
            visible: true, locked: false, geometry: geoJson.geometry,
        }

        layerToFeatureId.current.set(layer, newFeature.id)
        featureIdToLayer.current.set(newFeature.id, layer)
        if ('setStyle' in layer) {
            (layer as L.Path).setStyle({
                color: style.color, fillColor: style.fillColor,
                fillOpacity: style.fillOpacity, weight: style.weight,
            })
        }
        layer.on('click', () => {
            const fid = layerToFeatureId.current.get(layer)
            if (fid) setSelectedFeature(fid)
        })
        addFeature(newFeature)
        saveFeatureToBackend(newFeature)
    }, [currentTool, map, featureClass, addFeature, setSelectedFeature])

    const handleEdit = useCallback((e: any) => {
        const layer = e.layer as L.Layer
        const fid = layerToFeatureId.current.get(layer)
        if (!fid) return
        const geoJson = (layer as any).toGeoJSON() as GeoJSON.Feature
        updateFeature(fid, { geometry: geoJson.geometry })
        const feature = useEditorStore.getState().features.find(f => f.id === fid)
        if (feature?.backendId) {
            apiService.updateGeoObject(feature.backendId, { geometry: geoJson.geometry }).catch(console.error)
        }
    }, [updateFeature])

    const handleRemove = useCallback((e: any) => {
        const layer = e.layer as L.Layer
        const fid = layerToFeatureId.current.get(layer)
        if (!fid) return
        const feature = useEditorStore.getState().features.find(f => f.id === fid)
        layerToFeatureId.current.delete(layer)
        featureIdToLayer.current.delete(fid)
        deleteFeature(fid)
        if (feature?.backendId) { apiService.deleteGeoObject(feature.backendId).catch(console.error) }
    }, [deleteFeature])

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

    // ─── Load features ───────────────────────────────────────
    useEffect(() => {
        if (!map) return
        features.forEach((f) => {
            if (featureIdToLayer.current.has(f.id)) return 
            const geoJsonLayer = L.geoJSON(
                { type: 'Feature', properties: {}, geometry: f.geometry } as GeoJSON.Feature,
                {
                    smoothFactor: 0,
                    style: () => {
                        const style = getAdvancedStyle(f.featureClass, f.metadata, f.style)
                        const isLine = f.featureClass === 'road' || f.featureClass === 'river'
                        return {
                            color: style.color, fillColor: isLine ? 'transparent' : style.fillColor,
                            fillOpacity: isLine ? 0 : style.fillOpacity,
                            weight: style.weight, dashArray: style.dashArray, noClip: true
                        }
                    },
                    pointToLayer: (_: any, latlng: any) => {
                        return L.circleMarker(latlng, {
                            radius: 8, fillColor: f.style.fillColor, color: f.style.color,
                            weight: f.style.weight, fillOpacity: f.style.fillOpacity,
                        })
                    },
                } as any
            )
            geoJsonLayer.eachLayer((layer) => {
                layerToFeatureId.current.set(layer, f.id)
                featureIdToLayer.current.set(f.id, layer)
                layer.on('click', () => setSelectedFeature(f.id))
                if (f.visible) layer.addTo(map)
            })
        })
    }, [map, features, setSelectedFeature])

    // ─── Sync visibility & selection ─────────────────────────
    useEffect(() => {
        const currentFeatureIds = new Set(features.map(f => f.id))
        featureIdToLayer.current.forEach((layer, fid) => {
            if (!currentFeatureIds.has(fid)) {
                map.removeLayer(layer)
                featureIdToLayer.current.delete(fid)
            }
        })

        features.forEach((f) => {
            const layer = featureIdToLayer.current.get(f.id)
            if (!layer) return
            if (f.visible && !map.hasLayer(layer)) layer.addTo(map)
            else if (!f.visible && map.hasLayer(layer)) map.removeLayer(layer)

            if ('setStyle' in layer) {
                const style = getAdvancedStyle(f.featureClass, f.metadata, f.style)
                const isLine = f.featureClass === 'road' || f.featureClass === 'river'
                const isSelected = f.id === selectedFeatureId;
                
                (layer as L.Path).setStyle({
                    color: isSelected ? '#ff4500' : style.color, // Ярко-оранжевый для выделения
                    fillColor: isLine ? 'transparent' : style.fillColor,
                    fillOpacity: isLine ? 0 : (isSelected ? 0.8 : style.fillOpacity),
                    weight: isSelected ? Math.max(style.weight + 3, 5) : style.weight,
                    dashArray: undefined, // Сплошная линия для лучшей видимости
                    fill: !isLine
                })
                if (isSelected) (layer as L.Path).bringToFront()
            }
        })
    }, [map, features, selectedFeatureId])

    return { layerToFeatureId, featureIdToLayer }
}

async function saveFeatureToBackend(feature: EditorFeature) {
    try {
        const res = await apiService.createGeoObject({
            scope: 'private', type: feature.featureClass as any,
            name: feature.name, description: feature.description,
            metadata: { ...feature.style, fclass: feature.metadata?.fclass },
            geometry: feature.geometry as any,
        })
        useEditorStore.getState().updateFeature(feature.id, { backendId: (res as any).id })
    } catch (err) { console.error('Failed to save feature:', err) }
}
