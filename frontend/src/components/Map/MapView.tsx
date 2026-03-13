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
import ObjectDetailPanel from './ObjectDetailPanel'
import type { ObjectFormData } from './ObjectDetailPanel'

// World mask: a huge polygon covering the entire world with a hole for Kazakhstan
// This hides everything outside KZ
function buildWorldMask() {
  // Outer ring covering the whole world
  const worldRing: [number, number][] = [
    [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]
  ]
  // Inner ring = Kazakhstan boundary (reversed winding to create a hole)
  const kzCoords = (kazakhstanGeoJSON as any).geometry.coordinates[0] as [number, number][]
  const kzHole = [...kzCoords].reverse()

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [worldRing, kzHole]
    }
  }
}

const worldMaskGeoJSON = buildWorldMask()

// Component to fit bounds when objects change
function MapBoundsUpdater({ geoJson }: { geoJson: any }) {
  const map = useMap()

  useEffect(() => {
    if (geoJson && geoJson.features && geoJson.features.length > 0) {
      try {
        const layer = L.geoJSON(geoJson)
        const bounds = layer.getBounds()
        console.log('MapBoundsUpdater: bounds:', bounds)
        console.log('MapBoundsUpdater: isValid:', bounds.isValid())
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] })
        }
      } catch (e) {
        console.error('MapBoundsUpdater error:', e)
      }
    }
  }, [geoJson, map])

  return null
}

// Focus control: fits map to Kazakhstan bounds and toggles mask
function FocusControl({ focused, onToggle }: { focused: boolean; onToggle: () => void }) {
  const map = useMap()

  const handleFocus = useCallback(() => {
    const kzLayer = L.geoJSON(kazakhstanGeoJSON as any)
    const bounds = kzLayer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] })
    }
    onToggle()
  }, [map, onToggle])

  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: 10, marginLeft: 10 }}>
      <div className="leaflet-control">
        <button
          onClick={handleFocus}
          title={focused ? 'Show world map' : 'Focus on Kazakhstan'}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: focused ? '#10b981' : '#fff',
            color: focused ? '#fff' : '#334155',
            border: '2px solid rgba(0,0,0,0.2)',
            borderRadius: 6,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            fontSize: 18,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  )
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
    city: true,
    road: true,
    boundary: true,
    other: true,
  })
  const [selectedType, setSelectedType] = useState<ObjectType>('boundary')
  const [showDrawControl, setShowDrawControl] = useState(false)
  const [mapMode, setMapMode] = useState<'global' | 'private'>('global')
  const [focusKZ, setFocusKZ] = useState(false)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [pendingGeometry, setPendingGeometry] = useState<any>(null)
  const [editingObject, setEditingObject] = useState<GeoObject | null>(null)
  const [panelMode, setPanelMode] = useState<'create' | 'edit'>('create')
  const featureGroupRef = useRef<L.FeatureGroup>(null)

  // Fetch geo objects
  const fetchGeoObjects = useCallback(async () => {
    try {
      const response = await apiService.getGeoObjects()
      console.log('Fetched geo objects:', response.objects.length)
      response.objects.forEach((obj, i) => {
        console.log(`Object ${i}:`, obj.id, obj.name, obj.type, JSON.stringify(obj.geometry).substring(0, 100))
      })
      setGeoObjects(response.objects)
    } catch (error) {
      console.error('Error fetching geo objects:', error)
    }
  }, [])

  // Re-fetch when mapMode changes
  useEffect(() => {
    fetchGeoObjects()
  }, [fetchGeoObjects, mapMode])

  // Filter objects by visibility
  const visibleObjects = geoObjects.filter(
    (obj) => layerVisibility[obj.type as ObjectType]
  )

  // Handle layer created from drawing — open detail panel
  const handleCreated = (e: any) => {
    const layer = e.layer
    const geoJson = layer.toGeoJSON()
    setPendingGeometry(geoJson.geometry)
    setPanelMode('create')
    setEditingObject(null)
    setShowDetailPanel(true)
  }

  // Save from detail panel (create)
  const handleDetailSave = async (formData: ObjectFormData) => {
    if (panelMode === 'edit' && editingObject) {
      // Update existing object
      try {
        await apiService.updateGeoObject(editingObject.id, {
          name: formData.name,
          description: formData.description,
          metadata: formData.metadata,
        })
        await fetchGeoObjects()
        setShowDetailPanel(false)
        setEditingObject(null)
      } catch (error: any) {
        console.error('Error updating object:', error)
        alert(`Error: ${error.response?.data?.message || error.message}`)
      }
      return
    }

    // Create new object
    if (!pendingGeometry) return
    const request: CreateGeoObjectRequest = {
      scope: mapMode,
      type: selectedType,
      name: formData.name,
      description: formData.description,
      metadata: formData.metadata,
      geometry: pendingGeometry,
    }
    try {
      await apiService.createGeoObject(request)
      await fetchGeoObjects()
      if (featureGroupRef.current) {
        featureGroupRef.current.clearLayers()
      }
      setShowDetailPanel(false)
      setPendingGeometry(null)
    } catch (error: any) {
      console.error('Error creating object:', error)
      if (error.response) {
        alert(`Error: ${error.response.data.message || error.response.data.error}`)
      } else if (error.request) {
        alert('Network error - server not responding')
      } else {
        alert(`Error: ${error.message}`)
      }
    }
  }

  // Delete object
  const handleDetailDelete = async () => {
    if (!editingObject) return
    if (!confirm(`Delete "${editingObject.name}"?`)) return
    try {
      await apiService.deleteGeoObject(editingObject.id)
      await fetchGeoObjects()
      setShowDetailPanel(false)
      setEditingObject(null)
    } catch (error: any) {
      console.error('Error deleting object:', error)
      alert(`Error: ${error.response?.data?.message || error.message}`)
    }
  }

  // Cancel from detail panel
  const handleDetailCancel = () => {
    setShowDetailPanel(false)
    setPendingGeometry(null)
    setEditingObject(null)
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers()
    }
  }

  // Open edit panel for a specific object
  const openEditPanel = (objectId: string) => {
    const obj = geoObjects.find(o => o.id === objectId)
    if (!obj) return
    setEditingObject(obj)
    setSelectedType(obj.type as ObjectType)
    setPanelMode('edit')
    setShowDetailPanel(true)
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

  // Popup for each feature + click to edit
  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties?.name) {
      layer.bindPopup(`<strong>${feature.properties.name}</strong><br/><span style="text-transform:capitalize">${feature.properties.type}</span><br/><em style="color:#888;font-size:11px">Click to edit</em>`)
    }
    layer.on('click', () => {
      if (feature.properties?.id) {
        openEditPanel(feature.properties.id)
      }
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

  console.log('Rendering GeoJSON:', JSON.stringify(objectsGeoJSON).substring(0, 500))

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 dark:bg-slate-950">
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
              className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${mapMode === 'global'
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              onClick={() => setMapMode('global')}
            >
              Global
            </button>
            <button
              className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${mapMode === 'private'
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
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${showDrawControl
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
                onClick={() => openEditPanel(obj.id)}
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

      {/* Map Container */}
      <div className="flex-1 relative bg-slate-100">
        <MapContainer
          center={[48.0196, 66.9237]}
          zoom={5}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
          minZoom={3}
          maxZoom={20}
          maxBoundsViscosity={focusKZ ? 1.0 : 0}
        >
          <TileLayer
            url="https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {/* Kazakhstan boundary - only visible in focus mode */}
          {focusKZ && (
            <GeoJSON
              key="kz-border"
              // @ts-ignore - json import typing issue
              data={kazakhstanGeoJSON}
              style={{
                color: '#10b981',
                weight: 2,
                fillOpacity: 0,
              }}
            />
          )}

          {/* World mask - hides everything outside Kazakhstan */}
          {focusKZ && (
            // @ts-ignore
            <GeoJSON
              key="world-mask"
              data={worldMaskGeoJSON}
              style={{
                color: 'transparent',
                fillColor: '#020C1B',
                fillOpacity: 0.95,
                weight: 0,
              }}
            />
          )}

          {/* Focus button */}
          <FocusControl focused={focusKZ} onToggle={() => setFocusKZ(!focusKZ)} />

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
                edit={{
                  remove: true,
                }}
              />
            </FeatureGroup>
          )}

          {/* GeoJSON Objects - key forces re-render when data changes */}
          {objectsGeoJSON.features.length > 0 && (
            // @ts-ignore - GeoJSON type
            <GeoJSON
              key={JSON.stringify(objectsGeoJSON)}
              data={objectsGeoJSON}
              style={getStyle}
              pointToLayer={pointToLayer}
              onEachFeature={onEachFeature}
            />
          )}

          {/* Auto-fit bounds to objects */}
          <MapBoundsUpdater geoJson={objectsGeoJSON} />
        </MapContainer>

        {/* Object Detail Panel */}
        {showDetailPanel && (
          <ObjectDetailPanel
            type={panelMode === 'edit' && editingObject ? editingObject.type as ObjectType : selectedType}
            mode={panelMode}
            initialData={panelMode === 'edit' && editingObject ? {
              name: editingObject.name,
              description: editingObject.description,
              metadata: editingObject.metadata as Record<string, unknown> | undefined,
            } : undefined}
            onSave={handleDetailSave}
            onDelete={panelMode === 'edit' ? handleDetailDelete : undefined}
            onCancel={handleDetailCancel}
          />
        )}
      </div>
    </div>
  )
}
