import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.vectorgrid'
import { apiService } from '../../services/api'
import { getAdvancedStyle } from '../../types/editor'
import { useEditorStore } from '../../store/editorStore'

export default function VectorTileLayer() {
    const map = useMap()
    const layerRef = useRef<any>(null)

    useEffect(() => {
        if (!map) return

        const tileUrl = apiService.getTileUrl()

        const vectorTileOptions = {
            rendererFactory: (L.canvas as any).tile,
            vectorTileLayerStyles: {
                objects: (properties: any) => {
                    const style = getAdvancedStyle(properties.type, properties.metadata)
                    return {
                        color: style.color,
                        fillColor: style.fillColor,
                        fillOpacity: style.fillOpacity,
                        weight: style.weight,
                        fill: true,
                        dashArray: style.dashArray
                    }
                }
            },
            interactive: true,
            getFeatureId: (f: any) => f.properties?.id
        }

        // @ts-ignore
        const layer = L.vectorGrid.protobuf(tileUrl, vectorTileOptions)

        layer.on('click', (e: any) => {
            const tool = useEditorStore.getState().currentTool
            // If e.latlng is missing (common with canvas vectorgrid), calculate from original event
            const latlng = e.latlng || map.mouseEventToLatLng(e.originalEvent)
            
            console.log('[VectorTileLayer] click intercepted, tool =', tool, 'latlng =', latlng)

            // In edit/history mode: forward click to map so useGeoman's pickObjectAt handles it
            if (tool === 'edit' || tool === 'history') {
                map.fireEvent('click', {
                    latlng,
                    layerPoint: e.layerPoint,
                    containerPoint: e.containerPoint,
                    originalEvent: e.originalEvent,
                })
                return
            }

            // For other tools: just log
            const props = e.layer?.properties
            if (props) {
                console.log('Clicked vector feature:', props.name || props.id, props)
            }
        })

        layer.addTo(map)
        layerRef.current = layer

        return () => {
            if (layerRef.current) {
                layerRef.current.off('click')
                map.removeLayer(layerRef.current)
            }
        }
    }, [map])

    return null
}
