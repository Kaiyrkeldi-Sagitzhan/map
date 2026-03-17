import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.vectorgrid'
import { apiService } from '../../services/api'
import { getAdvancedStyle } from '../../types/editor'
import { useEditorStore } from '../../store/editorStore'
import { useViewerStore } from '../../store/viewerStore'

export default function VectorTileLayer() {
    const map = useMap()
    const layerRef = useRef<any>(null)
    const visibleLayersRef = useRef<Set<string>>(new Set(['lake', 'river', 'forest', 'road', 'building', 'city', 'mountain', 'boundary', 'other']))
    const featureClassFilterRef = useRef<string>('')
    const isViewer = window.location.pathname.startsWith('/map')

    // Subscribe to viewer state changes (layer visibility + type filter)
    useEffect(() => {
        if (!isViewer) return
        visibleLayersRef.current = useViewerStore.getState().visibleLayers
        featureClassFilterRef.current = useViewerStore.getState().featureClassFilter
        const unsub = useViewerStore.subscribe((state, prev) => {
            const needsRedraw =
                state.visibleLayers !== prev.visibleLayers ||
                state.featureClassFilter !== prev.featureClassFilter
            visibleLayersRef.current = state.visibleLayers
            featureClassFilterRef.current = state.featureClassFilter
            if (needsRedraw && layerRef.current) {
                layerRef.current.redraw()
            }
        })
        return unsub
    }, [isViewer])

    useEffect(() => {
        if (!map) return

        const tileUrl = apiService.getTileUrl()

        const vectorTileOptions = {
            rendererFactory: (L.canvas as any).tile,
            vectorTileLayerStyles: {
                objects: (properties: any) => {
                    // Hide layers that are toggled off in viewer
                    if (isViewer && !visibleLayersRef.current.has(properties.type)) {
                        return { fill: false, stroke: false, weight: 0, opacity: 0, fillOpacity: 0 }
                    }
                    const style = getAdvancedStyle(properties.type, properties.metadata)
                    const baseStyle = {
                        color: style.color,
                        fillColor: style.fillColor,
                        fillOpacity: style.fillOpacity,
                        weight: style.weight,
                        fill: true,
                        dashArray: style.dashArray
                    }
                    // Dim non-matching types when a filter is active
                    const filter = featureClassFilterRef.current
                    if (isViewer && filter && properties.type !== filter) {
                        return {
                            ...baseStyle,
                            fillOpacity: (baseStyle.fillOpacity || 0.4) * 0.15,
                            opacity: 0.15,
                            weight: Math.max((baseStyle.weight || 1) * 0.5, 0.5),
                        }
                    }
                    return baseStyle
                }
            },
            maxNativeZoom: 16,
            updateWhenZooming: false,
            updateWhenIdle: true,
            keepBuffer: 1,
            interactive: true,
            getFeatureId: (f: any) => f.properties?.id
        }

        // @ts-ignore
        const layer = L.vectorGrid.protobuf(tileUrl, vectorTileOptions)

        // Forward dblclick for polygon search area completion
        layer.on('dblclick', (e: any) => {
            const latlng = e.latlng || map.mouseEventToLatLng(e.originalEvent)
            map.fireEvent('dblclick', {
                latlng,
                layerPoint: e.layerPoint,
                containerPoint: e.containerPoint,
                originalEvent: e.originalEvent,
            })
        })

        layer.on('click', (e: any) => {
            const editorTool = useEditorStore.getState().currentTool
            const viewerTool = useViewerStore.getState().activeTool
            const isViewerPage = window.location.pathname.startsWith('/map')
            const tool = isViewerPage ? viewerTool : editorTool

            const latlng = e.latlng || map.mouseEventToLatLng(e.originalEvent)
            const props = e.layer?.properties
            console.log('[VTL] click', { tool, isViewerPage, featureId: props?.id, featureType: props?.type, props })

            // Block clicks on non-matching types when viewer filter is active
            // (except searchArea — Geoman handles its own click processing)
            if (isViewerPage && tool !== 'searchArea') {
                const filter = useViewerStore.getState().featureClassFilter
                const featureType = props?.type
                if (filter && featureType && featureType !== filter) {
                    console.log('[VTL] blocked — type mismatch', { filter, featureType })
                    return // Ignore click on dimmed (non-matching) object
                }
            }

            // Forward clicks to map for all interactive tools, including feature properties
            if (tool === 'edit' || tool === 'history' || tool === 'select' || tool === 'complaint' || tool === 'searchArea') {
                // Mark the DOM event so MapViewer skips the native duplicate click
                if (e.originalEvent) (e.originalEvent as any)._featureHandled = true
                console.log('[VTL] forwarding click with featureProperties', { id: props?.id, type: props?.type })
                map.fireEvent('click', {
                    latlng,
                    layerPoint: e.layerPoint,
                    containerPoint: e.containerPoint,
                    originalEvent: e.originalEvent,
                    featureProperties: props || null,
                })
                return
            }
        })

        // Cursor: pointer on hoverable objects, respect filter & active tool
        layer.on('mouseover', (e: any) => {
            const isViewerPage = window.location.pathname.startsWith('/map')
            const tool = isViewerPage ? useViewerStore.getState().activeTool : useEditorStore.getState().currentTool
            if (tool === 'searchArea') return
            if (isViewerPage) {
                const filter = useViewerStore.getState().featureClassFilter
                const featureType = e.layer?.properties?.type
                if (filter && featureType && featureType !== filter) return
            }
            map.getContainer().style.cursor = 'pointer'
        })
        layer.on('mouseout', () => {
            const isViewerPage = window.location.pathname.startsWith('/map')
            const tool = isViewerPage ? useViewerStore.getState().activeTool : useEditorStore.getState().currentTool
            if (tool === 'searchArea') return
            map.getContainer().style.cursor = ''
        })

        layer.addTo(map)
        layerRef.current = layer

        return () => {
            if (layerRef.current) {
                layerRef.current.off('click')
                layerRef.current.off('dblclick')
                layerRef.current.off('mouseover')
                layerRef.current.off('mouseout')
                map.removeLayer(layerRef.current)
            }
        }
    }, [map, isViewer])

    return null
}
