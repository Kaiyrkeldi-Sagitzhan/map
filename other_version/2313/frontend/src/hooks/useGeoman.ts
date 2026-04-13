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
        case 'freehand': return null
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
    const lastSyncedGeometry = useRef<Map<string, string>>(new Map())
    const geomanEditedIds = useRef<Set<string>>(new Set())
    const suppressClick = useRef(false)

    const {
        currentTool,
        featureClass,
        features,
        searchResults,
        selectedFeatureId,
        selectedFeatureIds,
        addFeature,
        updateFeature,
        deleteFeature,
        setSelectedFeature,
        toggleSelectedFeature,
        clearSelection,
        setSelectedFeatureById,
        setMouseCoords,
        setLoading,
        setGeometryDirty,
    } = useEditorStore()

    const searchLayers = useRef<L.Layer[]>([])

    const getDrawOptions = useCallback((tool: DrawTool) => {
        const style = CLASS_STYLES[featureClass]
        const isSearchArea = tool === 'searchArea'
        const isPolygonLike = tool === 'drawPolygon' || tool === 'searchArea'
        const isFreehand = tool === 'freehand'

        return {
            freehandMode: isFreehand,
            simplifyFactor: isFreehand ? 0 : undefined,
            continueDrawing: tool === 'drawPolygon',
            snappable: isPolygonLike,
            snapDistance: isPolygonLike ? 20 : (isFreehand ? 0 : 12),
            finishOn: isPolygonLike ? 'snap' : undefined,
            pathOptions: {
                color: isSearchArea ? '#6366f1' : style.color,
                fillColor: 'transparent',
                fillOpacity: 0,
                weight: isSearchArea ? 1 : style.weight,
                smoothFactor: isFreehand ? 0 : undefined,
            },
        }
    }, [featureClass])

    // ─── Track Keys (Shift & Escape) ────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { 
            if (e.key === 'Shift') {
                isShiftHeld.current = true
                if (currentTool === 'searchArea') {
                    map.pm.disableDraw()
                    map.pm.enableDraw('Rectangle' as any, getDrawOptions('searchArea') as any)
                }
            }
            if (e.key === 'Escape') {
                if (currentTool === 'searchArea') {
                    map.pm.disableDraw()
                    map.pm.enableDraw('Polygon' as any, getDrawOptions('searchArea') as any)
                    return
                }
                clearSelection()
                useEditorStore.getState().clearSearchResults()
                // Also disable any active geoman draw/edit
                map.pm.disableDraw()
                map.pm.disableGlobalEditMode()
            }
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                isShiftHeld.current = false
                if (currentTool === 'searchArea') {
                    map.pm.disableDraw()
                    map.pm.enableDraw('Polygon' as any, getDrawOptions('searchArea') as any)
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [map, clearSelection, currentTool, getDrawOptions])

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
                   // Contextual check: only allow adding if type matches or 'custom' is selected
                   if (featureClass !== 'custom' && featureClass !== 'other' && f.featureClass !== featureClass) {
                       return // Ignore click on wrong type
                   }
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
            snappable: true,
            snapDistance: 12,
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
    }, [map])

    // ─── Track mouse ────────────────────────────────────────
    useEffect(() => {
        if (!map) return
        const handler = (e: L.LeafletMouseEvent) => { setMouseCoords({ lat: e.latlng.lat, lng: e.latlng.lng }) }
        map.on('mousemove', handler)
        return () => { map.off('mousemove', handler) }
    }, [map, setMouseCoords])

    // ─── Edit/History tool: click to pick object ─────────────
    const pickObjectAt = useCallback(async (latlng: L.LatLng, additiveSelect: boolean = false) => {
        console.log('[pickObjectAt] called at', latlng.lat, latlng.lng, 'filter by:', featureClass)
        setLoading(true)
        const zoom = map.getZoom()
        const delta = Math.max(0.0001, 2.0 / Math.pow(2, zoom))
        const bbox = {
            minLat: latlng.lat - delta,
            minLng: latlng.lng - delta,
            maxLat: latlng.lat + delta,
            maxLng: latlng.lng + delta,
            zoom,
            filterByZoom: false,
        }

        try {
            const typeFilter = (featureClass === 'custom' || featureClass === 'other') ? '' : featureClass
            const res = await apiService.getGeoObjects(typeFilter, bbox)
            
            if (res.objects && res.objects.length > 0) {
                const obj = res.objects[0]
                
                // NEW: In history mode, we select the object directly by its backendId
                // without requiring it to be in the local project features.
                if (currentTool === 'history') {
                    await setSelectedFeatureById(obj.id)
                    return
                }

                const existing = useEditorStore.getState().features.find(
                    (f) => f.backendId === obj.id || f.id === obj.id
                )
                
                let targetFid: string
                if (existing) {
                    targetFid = existing.id
                } else {
                    // NEW: Confirmation prompt before adding to project
                    if (!confirm(`Вы хотите добавить объект "${obj.name || 'без названия'}" в проект для редактирования?`)) {
                        return
                    }

                    const newFeature: EditorFeature = {
                        id: obj.id, 
                        name: obj.name || 'Объект',
                        featureClass: (obj.type || 'custom') as any,
                        description: obj.description || '',
                        style: getSafeStyle(obj.type),
                        visible: true,
                        locked: false,
                        geometry: obj.geometry as GeoJSON.Geometry,
                        backendId: obj.id,
                        metadata: obj.metadata as any,
                    }
                    addFeature(newFeature)
                    saveFeatureToBackend(newFeature)
                    targetFid = newFeature.id
                }
                
                if (additiveSelect) {
                    toggleSelectedFeature(targetFid)
                } else if (targetFid !== useEditorStore.getState().selectedFeatureId) {
                    setSelectedFeature(targetFid)
                }

                // Auto-enable geoman edit only if in EDIT mode (not history)
                if (currentTool === 'edit') {
                    setTimeout(() => {
                        const layer = featureIdToLayer.current.get(targetFid)
                        if (layer) (layer as any).pm?.enable({ allowSelfIntersection: false })
                    }, 100)
                }
            }
        } catch (err) {
            console.error('Pick failed:', err)
        } finally {
            setLoading(false)
        }
    }, [map, addFeature, setSelectedFeature, toggleSelectedFeature, setLoading, currentTool, featureClass])

    useEffect(() => {
        if (!map) return
        const isEditOrHistory = currentTool === 'edit' || currentTool === 'history'

        const onMapClick = (e: L.LeafletMouseEvent) => {
            // Suppress clicks that fire after geoman vertex drag
            if (suppressClick.current) { suppressClick.current = false; return }
            if ((e.originalEvent as any)?._simulated) return
            console.log('[useGeoman] map click, tool =', currentTool, 'isEditOrHistory =', isEditOrHistory)
            if (isEditOrHistory) {
                pickObjectAt(e.latlng, !!(e.originalEvent as MouseEvent | undefined)?.shiftKey)
            } else if (currentTool === 'select') {
                if (!(e.originalEvent as MouseEvent | undefined)?.shiftKey) {
                    clearSelection()
                }
            }
        }
        map.on('click', onMapClick)

        const container = map.getContainer()
        if (isEditOrHistory) {
            container.classList.add('cursor-pencil')
        } else {
            container.classList.remove('cursor-pencil')
        }

        return () => {
            map.off('click', onMapClick)
            container.classList.remove('cursor-pencil')
        }
    }, [map, currentTool, pickObjectAt, clearSelection])

    // ─── Sync draw mode ──────────────────────────────────────
    useEffect(() => {
        if (!map) return
        map.pm.disableDraw()
        map.pm.disableGlobalEditMode()

        // For edit/history tools, don't activate geoman draw modes
        if (currentTool === 'edit' || currentTool === 'history') {
            prevTool.current = currentTool
            return
        }

        if (currentTool === 'select') {
            map.pm.enableGlobalEditMode({ allowSelfIntersection: false })
        } else {
            const geomanMode = toolToGeomanMode(currentTool, isShiftHeld.current)
            if (geomanMode) {
                map.pm.enableDraw(geomanMode as any, getDrawOptions(currentTool) as any)
            }
        }
        prevTool.current = currentTool
    }, [map, currentTool, getDrawOptions])

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
        layer.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e)
            const fid = layerToFeatureId.current.get(layer)
            if (!fid) return
            const additive = !!(e.originalEvent as MouseEvent | undefined)?.shiftKey
            if (additive) toggleSelectedFeature(fid)
            else setSelectedFeature(fid)
        })
        addFeature(newFeature)
        saveFeatureToBackend(newFeature)
    }, [currentTool, map, featureClass, addFeature, setSelectedFeature, toggleSelectedFeature])

    const handleEdit = useCallback((e: any) => {
        const layer = e.layer as L.Layer
        const fid = layerToFeatureId.current.get(layer)
        if (!fid) return

        const geoJson = (layer as any).toGeoJSON() as GeoJSON.Feature
        console.log('[useGeoman] Point moved/dragged, updating feature in store:', fid)

        // Suppress the map click that fires after vertex drag release
        suppressClick.current = true
        setTimeout(() => { suppressClick.current = false }, 200)

        // Mark as geoman-originated so the sync effect skips re-applying to this layer
        geomanEditedIds.current.add(fid)
        setGeometryDirty(true)
        updateFeature(fid, { geometry: geoJson.geometry })
    }, [updateFeature, setGeometryDirty])

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
        if (!map || !map.pm) return
        
        const onCreate = (e: any) => handleCreate(e)
        const onEdit = (e: any) => handleEdit(e)
        const onRemove = (e: any) => handleRemove(e)

        map.on('pm:create', onCreate)
        map.on('pm:edit', onEdit)
        map.on('pm:dragend', onEdit)
        map.on('pm:remove', onRemove)

        return () => {
            if (map && map.pm) {
                map.off('pm:create', onCreate)
                map.off('pm:edit', onEdit)
                map.off('pm:dragend', onEdit)
                map.off('pm:remove', onRemove)
            }
        }
    }, [map, handleCreate, handleEdit, handleRemove])

    // ─── Custom Freehand Drawing ──────────────────────────────
    useEffect(() => {
        if (!map) return
        if (currentTool !== 'freehand') {
            map.dragging.enable() // ensure dragging is enabled
            return
        }

        let freehandLayer: L.Polyline | null = null
        let isDrawingFreehand = false
        const style = CLASS_STYLES[featureClass] || { color: '#000', weight: 2 }

        const onMouseDown = (e: L.LeafletMouseEvent) => {
            if ((e.originalEvent as MouseEvent).button !== 0) return // only left click
            isDrawingFreehand = true
            map.dragging.disable()
            freehandLayer = L.polyline([e.latlng], {
                color: style.color as string,
                weight: style.weight as number,
                smoothFactor: 1.5,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(map)
        }

        const onMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDrawingFreehand || !freehandLayer) return
            freehandLayer.addLatLng(e.latlng)
        }

        const onMouseUp = () => {
            if (!isDrawingFreehand || !freehandLayer) return
            isDrawingFreehand = false
            map.dragging.enable()
            
            const latlngs = freehandLayer.getLatLngs() as L.LatLng[]
            if (latlngs.length > 2) {
                // handleCreate will use this layer
                handleCreate({ layer: freehandLayer })
            } else {
                map.removeLayer(freehandLayer)
            }
            freehandLayer = null
        }

        map.on('mousedown', onMouseDown)
        map.on('mousemove', onMouseMove)
        map.on('mouseup', onMouseUp)

        const container = map.getContainer()
        container.style.cursor = 'crosshair'

        return () => {
            map.off('mousedown', onMouseDown)
            map.off('mousemove', onMouseMove)
            map.off('mouseup', onMouseUp)
            container.style.cursor = ''
            if (isDrawingFreehand && freehandLayer) map.removeLayer(freehandLayer)
            map.dragging.enable()
        }
    }, [map, currentTool, featureClass, handleCreate])

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
                layer.on('click', (e: L.LeafletMouseEvent) => {
                    L.DomEvent.stopPropagation(e)
                    
                    // Contextual pick: restrict selection to the active type if in edit/history mode
                    const state = useEditorStore.getState()
                    const activeTool = state.currentTool
                    const activeType = state.featureClass
                    
                    if (activeTool === 'edit' || activeTool === 'history') {
                        if (activeType !== 'custom' && activeType !== 'other' && f.featureClass !== activeType) {
                            console.log('[useGeoman] Selection ignored: type mismatch', f.featureClass, 'vs active:', activeType)
                            return // Ignore click on wrong type
                        }
                    }

                    const additive = !!(e.originalEvent as MouseEvent | undefined)?.shiftKey
                    if (additive) toggleSelectedFeature(f.id)
                    else setSelectedFeature(f.id)
                })
                
                // CRITICAL: Attach edit listeners to the specific layer
                layer.on('pm:edit', handleEdit)
                layer.on('pm:dragend', handleEdit)

                if (f.visible) layer.addTo(map)
            })
        })
    }, [map, features, setSelectedFeature, toggleSelectedFeature])

    // ─── Sync visibility & selection ─────────────────────────
    // ─── Sync Features to Map ──────────────────────────────────
    useEffect(() => {
        try {
            // Remove layers for deleted features
            const currentFeatureIds = new Set(features.map(f => f.id))
            const layersToRemove: string[] = []
            featureIdToLayer.current.forEach((layer, fid) => {
                if (!currentFeatureIds.has(fid)) {
                    try {
                        map.removeLayer(layer)
                    } catch (e) {
                        console.warn('[useGeoman] Failed to remove layer', fid, e)
                    }
                    layersToRemove.push(fid)
                }
            })
            layersToRemove.forEach(fid => {
                featureIdToLayer.current.delete(fid)
                lastSyncedGeometry.current.delete(fid)
                geomanEditedIds.current.delete(fid)
            })

            // Sync each feature's state to its layer
            features.forEach((f) => {
                try {
                    const layer = featureIdToLayer.current.get(f.id)
                    if (!layer) return

                    const isSelected = selectedFeatureIds.includes(f.id)
                    const isPrimarySelected = f.id === selectedFeatureId

                    // Visibility sync
                    try {
                        if (f.visible && !map.hasLayer(layer)) {
                            layer.addTo(map)
                        } else if (!f.visible && map.hasLayer(layer)) {
                            map.removeLayer(layer)
                        }
                    } catch (e) {
                        console.warn('[useGeoman] Visibility sync failed for', f.id)
                    }

                    // Only apply styling if layer supports it
                    if ('setStyle' in layer) {
                        // Geometry sync only if changed (and NOT currently being edited)
                        const geoKey = JSON.stringify(f.geometry)
                        const lastKey = lastSyncedGeometry.current.get(f.id)
                        const isCurrentlyBeingEdited = (layer as any)?.pm?.enabled?.() === true

                        // SKIP geometry sync if user is currently editing this layer
                        if (!isCurrentlyBeingEdited && !geomanEditedIds.current.has(f.id) && geoKey !== lastKey) {
                            try {
                                // Apply geometry WITHOUT touching PM
                                if (f.geometry.type === 'Point') {
                                    const c = f.geometry.coordinates as number[]
                                    ;(layer as any)?.setLatLng?.([c[1], c[0]])
                                } else if (f.geometry.type === 'LineString' || f.geometry.type === 'Polygon') {
                                    const coords = L.GeoJSON.coordsToLatLngs(
                                        f.geometry.coordinates,
                                        f.geometry.type === 'Polygon' ? 1 : 0
                                    )
                                    ;(layer as any)?.setLatLngs?.(coords as any)
                                } else if (f.geometry.type === 'MultiPolygon') {
                                    const coords = L.GeoJSON.coordsToLatLngs(f.geometry.coordinates, 2)
                                    ;(layer as any)?.setLatLngs?.(coords as any)
                                } else if (f.geometry.type === 'MultiLineString') {
                                    const coords = L.GeoJSON.coordsToLatLngs(f.geometry.coordinates, 1)
                                    ;(layer as any)?.setLatLngs?.(coords as any)
                                }

                                lastSyncedGeometry.current.set(f.id, geoKey)
                            } catch (geoErr) {
                                console.warn('[useGeoman] Geometry sync failed for', f.id, geoErr)
                            }
                        } else if (geomanEditedIds.current.has(f.id)) {
                            geomanEditedIds.current.delete(f.id)
                            lastSyncedGeometry.current.set(f.id, geoKey)
                        }

                        // Apply styling based on selection
                        try {
                            const style = getAdvancedStyle(f.featureClass, f.metadata, f.style)
                            const isLine = f.featureClass === 'road' || f.featureClass === 'river'

                            const styleObj: any = {
                                color: isSelected ? '#ff4500' : style.color,
                                fillColor: isLine ? 'transparent' : style.fillColor,
                                fillOpacity: isLine ? 0 : (isSelected ? 0.8 : style.fillOpacity),
                                weight: isSelected ? Math.max(style.weight + 3, 5) : style.weight,
                                fill: !isLine
                            }
                            if (style.dashArray) {
                                styleObj.dashArray = style.dashArray
                            }
                            ;(layer as L.Path)?.setStyle?.(styleObj)
                        } catch (styleErr) {
                            console.warn('[useGeoman] setStyle failed for feature', f.id, styleErr)
                        }

                        // Bring selected to front
                        if (isSelected) {
                            try {
                                ;(layer as L.Path)?.bringToFront?.()
                            } catch (e) {
                                // Ignore bringToFront errors
                            }
                        }

                        // SIMPLIFIED PM MANAGEMENT:
                        // ONLY enable PM on the PRIMARY selected layer in edit mode
                        // NEVER disable PM or manage it on any other layer
                        if (isPrimarySelected && currentTool === 'edit') {
                            try {
                                const pmLayer = (layer as any)?.pm
                                if (pmLayer) {
                                    const isAlreadyEnabled = pmLayer.enabled?.() === true
                                    if (!isAlreadyEnabled) {
                                        pmLayer.enable({
                                            allowSelfIntersection: false,
                                            preventMarkerRemoval: false,
                                            snappable: true,
                                        })
                                    }
                                }
                            } catch (e) {
                                console.warn('[useGeoman] Failed to enable pm for primary', f.id, e)
                            }
                        }
                        // For all other layers, DO NOT touch PM at all
                        // This prevents Geoman listener conflicts
                    }
                } catch (err) {
                    console.warn('[useGeoman] Feature sync error for', f.id, err)
                }
            })
        } catch (err) {
            console.error('[useGeoman] Sync effect error:', err)
        }
    }, [map, features, selectedFeatureId, selectedFeatureIds, currentTool])

    // ─── Map Refresh Event ──────────────────────────────────
    useEffect(() => {
        const handleRefresh = () => {
            console.log('[useGeoman] Map refresh triggered')
            // This forces the sync effect to run by clearing and re-setting IDs
            lastSyncedGeometry.current.clear()
            geomanEditedIds.current.clear()
            // We need to trigger a re-render of the sync effect
            updateFeature('', {}) // dummy update to trigger effect
        }
        window.addEventListener('refresh-map', handleRefresh)
        return () => window.removeEventListener('refresh-map', handleRefresh)
    }, [updateFeature])

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
