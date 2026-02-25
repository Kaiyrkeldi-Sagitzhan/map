import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import { FeatureGroup } from 'react-leaflet'
// @ts-ignore - react-leaflet-draw types are incompatible
import { EditControl } from 'react-leaflet-draw'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import { useAuth } from '../../context/AuthContext'
import { apiService } from '../../services/api'
import type { GeoObject, LayerVisibility, ObjectType, CreateGeoObjectRequest } from '../../types'
import kazakhstanGeoJSON from '../../assets/kazakhstan.json'

// Component to fit bounds when objects change
function MapBoundsUpdater({ geoJson }: { geoJson: any }) {
  const map = useMap()
  
  useEffect(() => {
    if (geoJson && geoJson.features && geoJson.features.length > 0) {
      const layer = L.geoJSON(geoJson)
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [geoJson, map])
  
  return null
}

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Layer colors - water-focused palette from map project
const layerColors: Record<ObjectType, string> = {
  river: '#3b82f6',
  lake: '#0ea5e9',
  mountain: '#64748b',
  region: '#8b5cf6',
  city: '#f59e0b',
  road: '#6b7280',
  boundary: '#10b981',
  other: '#6366f1',
}

export default function MapView() {
  const { isAdmin } = useAuth()
  const [geoObjects, setGeoObjects] = useState<GeoObject[]>([])
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    river: true,
    lake: true,
    mountain: true,
    region: true,
    city: true,
    road: true,
    boundary: true,
    other: true,
  })
  const [selectedType, setSelectedType] = useState<ObjectType>('region')
  const [showDrawControl, setShowDrawControl] = useState(false)
  const [mapMode, setMapMode] = useState<'global' | 'private'>('global')
  const [isDark] = useState(true)
  const featureGroupRef = useRef<L.FeatureGroup>(null)

  // Fetch geo objects
  const fetchGeoObjects = useCallback(async () => {
    try {
      const response = await apiService.getGeoObjects()
      setGeoObjects(response.objects)
    } catch (error) {
      console.error('Error fetching geo objects:', error)
    }
  }, [])

  useEffect(() => {
    fetchGeoObjects()
  }, [fetchGeoObjects])

  // Filter objects by visibility
  const visibleObjects = geoObjects.filter(
    (obj) => layerVisibility[obj.type as ObjectType]
  )

  console.log('All geoObjects:', geoObjects)
  console.log('Visible objects:', visibleObjects)

  // Handle layer created from drawing
  const handleCreated = async (e: any) => {
    const layer = e.layer
    const geoJson = layer.toGeoJSON()
    
    console.log('Created GeoJSON:', JSON.stringify(geoJson, null, 2))
    
    const request: CreateGeoObjectRequest = {
      scope: mapMode,
      type: selectedType,
      name: `New ${selectedType}`,
      geometry: geoJson,
    }

    try {
      console.log('Sending request:', JSON.stringify(request, null, 2))
      const result = await apiService.createGeoObject(request)
      console.log('Object created successfully:', result)
      await fetchGeoObjects()
      if (featureGroupRef.current) {
        featureGroupRef.current.clearLayers()
      }
    } catch (error: any) {
      console.error('Error creating object:', error)
      if (error.response) {
        console.error('Server error:', error.response.data)
        alert(`Error: ${error.response.data.message || error.response.data.error}`)
      } else if (error.request) {
        alert('Network error - server not responding')
      } else {
        alert(`Error: ${error.message}`)
      }
    }
  }

  // Toggle layer visibility
  const toggleLayer = (type: ObjectType) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))
  }

  // Style function for GeoJSON layers
  const getStyle = (feature: any) => {
    const type = feature?.properties?.type || 'other'
    return {
      color: layerColors[type as ObjectType] || layerColors.other,
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.3,
    }
  }

  // Point to layer for markers
  const pointToLayer = (feature: any, latlng: any) => {
    const type = feature?.properties?.type || 'other'
    return L.circleMarker(latlng, {
      radius: 8,
      fillColor: layerColors[type as ObjectType] || layerColors.other,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    })
  }

  // GeoJSON data for objects
  const objectsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: visibleObjects.map(obj => ({
      type: 'Feature' as const,
      properties: {
        id: obj.id,
        name: obj.name,
        type: obj.type,
      },
      geometry: obj.geometry,
    }))
  }

  console.log('GeoJSON to render:', JSON.stringify(objectsGeoJSON, null, 2))

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-600">
          <h2 className="text-xl font-bold text-white">Kazakhstan Map</h2>
          <p className="text-emerald-200 text-sm">Interactive Geo Portal</p>
        </div>
        
        {/* Controls */}
        <div className="p-4 space-y-4">
          {/* Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            <button
              className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                mapMode === 'global' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              onClick={() => setMapMode('global')}
            >
              Global
            </button>
            <button
              className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                mapMode === 'private' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              onClick={() => setMapMode('private')}
            >
              Personal
            </button>
          </div>

          {/* Draw Controls */}
          {(isAdmin || mapMode === 'private') && (
            <div className="space-y-2">
              <button
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                  showDrawControl 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
                onClick={() => setShowDrawControl(!showDrawControl)}
              >
                {showDrawControl ? 'Cancel Drawing' : 'Draw Object'}
              </button>
              
              {showDrawControl && (
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as ObjectType)}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="river">River</option>
                  <option value="lake">Lake</option>
                  <option value="mountain">Mountain</option>
                  <option value="region">Region</option>
                  <option value="city">City</option>
                  <option value="road">Road</option>
                  <option value="boundary">Boundary</option>
                  <option value="other">Other</option>
                </select>
              )}
            </div>
          )}
        </div>

        {/* Layer Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Layers
          </h3>
          <div className="space-y-2">
            {(Object.keys(layerVisibility) as ObjectType[]).map((type) => (
              <label 
                key={type} 
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={layerVisibility[type]}
                  onChange={() => toggleLayer(type)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                />
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: layerColors[type] }}
                />
                <span className="text-slate-700 dark:text-slate-300 capitalize">
                  {type}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Object List */}
        <div className="flex-1 p-4 border-t border-slate-200 dark:border-slate-800 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Objects ({visibleObjects.length})
          </h3>
          <ul className="space-y-2">
            {visibleObjects.slice(0, 10).map((obj) => (
              <li 
                key={obj.id} 
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: layerColors[obj.type as ObjectType] }}
                />
                <span className="text-slate-700 dark:text-slate-300 truncate flex-1">
                  {obj.name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-500 capitalize">
                  {obj.type}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[48.0196, 66.9237]}
          zoom={5}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            url={isDark
              ? "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            }
          />
          
          {/* Kazakhstan boundary */}
          <GeoJSON
            // @ts-ignore - json import typing issue
            data={kazakhstanGeoJSON}
            style={{
              color: '#64748b',
              weight: 1,
              fillOpacity: 0.1,
              dashArray: '3'
            }}
          />
          
          {/* User-drawn objects */}
          {showDrawControl && (
            <FeatureGroup ref={featureGroupRef}>
              {/* @ts-ignore - react-leaflet-draw types are incompatible */}
              <EditControl
                position="topright"
                onCreated={handleCreated}
                draw={{
                  rectangle: false,
                  circle: false,
                  circlemarker: false,
                  marker: true,
                  polyline: true,
                  polygon: true,
                }}
              />
            </FeatureGroup>
          )}
          
          {/* GeoJSON Objects */}
          {/* @ts-ignore - GeoJSON type */}
          <GeoJSON
            data={objectsGeoJSON}
            style={getStyle}
            pointToLayer={pointToLayer}
          />
          
          {/* Auto-fit bounds to objects */}
          <MapBoundsUpdater geoJson={objectsGeoJSON} />
        </MapContainer>
      </div>
    </div>
  )
}
