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
  selectedFeatures: ViewerFeature[]
  selectedFeatureIds: string[]
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
  activeTool: 'select' | 'measure' | 'searchArea' | 'history' | 'complaint'

  // Layer visibility (multi-select)
  visibleLayers: Set<string>

  // Type filter (empty string = all types)
  featureClassFilter: string

  // Area-search layer filters
  searchAreaLayers: Set<string>

  // Actions
  setSelectedFeature: (feature: ViewerFeature | null) => void
  setPrimarySelectedFeature: (feature: ViewerFeature | null) => void
  toggleSelectedFeature: (feature: ViewerFeature) => void
  clearSelection: () => void
  setSelectedFeatureId: (id: string | null) => void
  setMouseCoords: (coords: MouseCoords | null) => void
  setSearchResults: (results: ViewerFeature[]) => void
  clearSearchResults: () => void
  setIsSearching: (v: boolean) => void
  fetchFeatureHistory: (objectId: string) => Promise<void>
  setShowMap: (v: boolean) => void
  setMapOpacity: (v: number) => void
  setActiveTool: (tool: 'select' | 'measure' | 'searchArea' | 'history' | 'complaint') => void
  toggleLayerVisibility: (layerId: string) => void
  setHighlight: (geometry: any, style?: any) => void
  clearHighlight: () => void
  setFeatureClassFilter: (filter: string) => void
  toggleSearchAreaLayer: (layerId: string) => void
  resetSearchAreaLayers: () => void
}

const DEFAULT_VISIBLE_LAYERS = new Set(['lake', 'river', 'forest', 'road', 'mountain', 'boundary', 'other'])
const DEFAULT_SEARCH_AREA_LAYERS = new Set(['lake', 'river', 'forest', 'road'])

export const useViewerStore = create<ViewerState>((set) => ({
  selectedFeature: null,
  selectedFeatureId: null,
  selectedFeatures: [],
  selectedFeatureIds: [],
  serverHistory: [],
  highlightGeometry: null,
  highlightStyle: null,
  searchResults: [],
  isSearching: false,
  mouseCoords: null,
  showMap: true,
  mapOpacity: 1,
  activeTool: 'select',
  visibleLayers: new Set(DEFAULT_VISIBLE_LAYERS),
  featureClassFilter: '',
  searchAreaLayers: new Set(DEFAULT_SEARCH_AREA_LAYERS),

  setSelectedFeature: (feature) => set((_s) => ({
    selectedFeature: feature,
    selectedFeatureId: feature?.id || null,
    selectedFeatures: feature ? [feature] : [],
    selectedFeatureIds: feature ? [feature.id] : [],
    ...(feature ? {} : { serverHistory: [], highlightGeometry: null, highlightStyle: null }),
  })),
  setPrimarySelectedFeature: (feature) => set((state) => {
    if (!feature) {
      return {
        selectedFeature: null,
        selectedFeatureId: null,
      }
    }

    const featureKey = feature.backendId || feature.id
    const existsInMulti = state.selectedFeatures.some((f) => (f.backendId || f.id) === featureKey)

    if (!existsInMulti) {
      return {
        selectedFeature: feature,
        selectedFeatureId: feature.id,
        selectedFeatures: [feature],
        selectedFeatureIds: [feature.id],
      }
    }

    return {
      selectedFeature: feature,
      selectedFeatureId: feature.id,
    }
  }),
  toggleSelectedFeature: (feature) => set((state) => {
    const featureKey = feature.backendId || feature.id
    const exists = state.selectedFeatures.some((f) => (f.backendId || f.id) === featureKey)

    if (exists) {
      const nextSelectedFeatures = state.selectedFeatures.filter((f) => (f.backendId || f.id) !== featureKey)
      const nextPrimary = nextSelectedFeatures[nextSelectedFeatures.length - 1] || null
      return {
        selectedFeatures: nextSelectedFeatures,
        selectedFeatureIds: nextSelectedFeatures.map((f) => f.id),
        selectedFeature: nextPrimary,
        selectedFeatureId: nextPrimary?.id || null,
        ...(nextPrimary ? {} : { serverHistory: [], highlightGeometry: null, highlightStyle: null }),
      }
    }

    const nextSelectedFeatures = [...state.selectedFeatures, feature]
    return {
      selectedFeatures: nextSelectedFeatures,
      selectedFeatureIds: nextSelectedFeatures.map((f) => f.id),
      selectedFeature: feature,
      selectedFeatureId: feature.id,
    }
  }),
  clearSelection: () => set({
    selectedFeature: null,
    selectedFeatureId: null,
    selectedFeatures: [],
    selectedFeatureIds: [],
    serverHistory: [],
    highlightGeometry: null,
    highlightStyle: null,
  }),
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
  toggleSearchAreaLayer: (layerId: string) => set((state) => {
    const next = new Set(state.searchAreaLayers)
    if (next.has(layerId)) {
      next.delete(layerId)
    } else {
      next.add(layerId)
    }
    return { searchAreaLayers: next }
  }),
  resetSearchAreaLayers: () => set({ searchAreaLayers: new Set(DEFAULT_SEARCH_AREA_LAYERS) }),

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
      set({ serverHistory: [] })
    }
  },
}))
