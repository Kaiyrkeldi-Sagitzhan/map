import { create } from 'zustand'
import { apiService } from '../services/api'

export interface ViewerFeature {
  id: string
  backendId?: string
  name: string
  type: string
  description?: string
  metadata?: Record<string, unknown>
  geometry: any
  style?: any
}

export interface ServerHistoryEntry {
  id: string
  objectId: string
  userId: string
  action: 'create' | 'update' | 'delete'
  description: string
  beforeSnapshot?: any
  afterSnapshot?: any
  createdAt: string
}

interface MouseCoords {
  lat: number
  lng: number
}

interface ViewerState {
  // Selected feature
  selectedFeature: ViewerFeature | null
  selectedFeatureId: string | null
  serverHistory: ServerHistoryEntry[]
  // Highlight overlay (GeoJSON to show on map)
  highlightGeometry: any | null
  highlightStyle: any | null

  // Search
  searchResults: ViewerFeature[]
  isSearching: boolean

  // Map state
  mouseCoords: MouseCoords | null
  showMap: boolean
  mapOpacity: number
  activeTool: 'select' | 'searchArea' | 'history' | 'complaint'

  // Layer visibility (multi-select)
  visibleLayers: Set<string>

  // Type filter (empty string = all types)
  featureClassFilter: string

  // Actions
  setSelectedFeature: (feature: ViewerFeature | null) => void
  setSelectedFeatureId: (id: string | null) => void
  setMouseCoords: (coords: MouseCoords | null) => void
  setSearchResults: (results: ViewerFeature[]) => void
  clearSearchResults: () => void
  setIsSearching: (v: boolean) => void
  fetchFeatureHistory: (objectId: string) => Promise<void>
  setShowMap: (v: boolean) => void
  setMapOpacity: (v: number) => void
  setActiveTool: (tool: 'select' | 'searchArea' | 'history' | 'complaint') => void
  toggleLayerVisibility: (layerId: string) => void
  setHighlight: (geometry: any, style?: any) => void
  clearHighlight: () => void
  setFeatureClassFilter: (filter: string) => void
}

const ALL_LAYERS = new Set(['lake', 'river', 'forest', 'road', 'building', 'city', 'mountain', 'boundary', 'other'])

export const useViewerStore = create<ViewerState>((set) => ({
  selectedFeature: null,
  selectedFeatureId: null,
  serverHistory: [],
  highlightGeometry: null,
  highlightStyle: null,
  searchResults: [],
  isSearching: false,
  mouseCoords: null,
  showMap: true,
  mapOpacity: 1,
  activeTool: 'select',
  visibleLayers: new Set(ALL_LAYERS),
  featureClassFilter: '',

  setSelectedFeature: (feature) => set((_s) => ({
    selectedFeature: feature,
    selectedFeatureId: feature?.id || null,
    ...(feature ? {} : { serverHistory: [], highlightGeometry: null, highlightStyle: null }),
  })),
  setSelectedFeatureId: (id) => set({ selectedFeatureId: id }),
  setMouseCoords: (coords) => set({ mouseCoords: coords }),
  setSearchResults: (results) => set({ searchResults: results }),
  clearSearchResults: () => set({ searchResults: [], isSearching: false }),
  setIsSearching: (v) => set({ isSearching: v }),
  setShowMap: (v) => set({ showMap: v }),
  setMapOpacity: (v) => set({ mapOpacity: v }),
  setActiveTool: (tool) => set({ activeTool: tool }),

  toggleLayerVisibility: (layerId: string) => set((state) => {
    const next = new Set(state.visibleLayers)
    if (next.has(layerId)) {
      next.delete(layerId)
    } else {
      next.add(layerId)
    }
    return { visibleLayers: next }
  }),

  setHighlight: (geometry, style) => set({ highlightGeometry: geometry, highlightStyle: style || null }),
  clearHighlight: () => set({ highlightGeometry: null, highlightStyle: null }),
  setFeatureClassFilter: (filter) => set({ featureClassFilter: filter }),

  fetchFeatureHistory: async (objectId: string) => {
    try {
      const history = await apiService.getGeoObjectHistory(objectId)
      set({
        serverHistory: (history || []).map((h: any) => ({
          id: h.id,
          objectId: h.object_id || h.objectId,
          userId: h.user_id || h.userId,
          action: h.action,
          description: h.description,
          beforeSnapshot: h.before_snapshot || h.beforeSnapshot,
          afterSnapshot: h.after_snapshot || h.afterSnapshot,
          createdAt: h.created_at || h.createdAt,
        })),
      })
    } catch (e) {
      console.error('Failed to fetch history:', e)
      set({ serverHistory: [] })
    }
  },
}))
