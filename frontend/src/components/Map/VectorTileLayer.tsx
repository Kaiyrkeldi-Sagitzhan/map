import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.vectorgrid'
import { apiService } from '../../services/api'
import { getAdvancedStyle } from '../../types/editor'

export default function VectorTileLayer() {
    const map = useMap()
    const layerRef = useRef<any>(null)

    useEffect(() => {
        if (!map) return

        const tileUrl = apiService.getTileUrl()
        
        // Define vector tile styling based on our advanced cartography engine
        const vectorTileOptions = {
            rendererFactory: (L.canvas as any).tile,
            vectorTileLayerStyles: {
                // 'objects' is the layer name defined in our PostGIS MVT query
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
            getFeatureId: (f: any) => f.properties.id
        }

        // @ts-ignore - Leaflet.VectorGrid is not typed in standard leaflet
        const layer = L.vectorGrid.protobuf(tileUrl, vectorTileOptions)

        layer.on('click', (e: any) => {
            const props = e.layer.properties
            console.log('Clicked feature:', props)
            // Here we can trigger selection in the future
        })

        layer.addTo(map)
        layerRef.current = layer

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current)
            }
        }
    }, [map])

    return null
}
