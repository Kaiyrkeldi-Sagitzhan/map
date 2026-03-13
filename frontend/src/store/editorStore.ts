/**
 * Zustand store for the Figma-like map editor.
 * Manages tools, features, layers, undo/redo history, and mouse coords.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
    DrawTool,
    FeatureClass,
    EditorFeature,
    LayerNode,
    HistoryEntry,
    EditHistoryEntry,
    MouseCoords,
    ClassStyle,
} from '../types/editor'
import { CLASS_STYLES } from '../types/editor'
import { apiService } from '../services/api'
import type { GeoObjectHistory } from '../types'

// ─── Store Interface ───────────────────────────────────────
interface EditorState {
    // Current tool & class
    currentTool: DrawTool
    featureClass: FeatureClass

    // Features
    features: EditorFeature[]
    selectedFeatureId: string | null
    
    // Search results (temporary view)
    searchResults: EditorFeature[]

    // Layers tree
    layers: LayerNode[]

    // Undo / Redo
    history: HistoryEntry[]
    historyIndex: number

    // Mouse coordinates
    mouseCoords: MouseCoords | null
    
    // UI State
    showMap: boolean
    mapOpacity: number
    isLoading: boolean
    editHistory: EditHistoryEntry[]
    serverHistory: GeoObjectHistory[]
    isGeometryDirty: boolean

    // ─── Actions ─────────────────────────────────────────────
    setTool: (tool: DrawTool) => void
    setFeatureClass: (fc: FeatureClass) => void
    setSelectedFeature: (id: string | null) => void
    setMouseCoords: (coords: MouseCoords | null) => void
    setShowMap: (show: boolean) => void
    setMapOpacity: (opacity: number) => void
    setLoading: (loading: boolean) => void
    setGeometryDirty: (dirty: boolean) => void
    addEditHistoryEntry: (entry: EditHistoryEntry) => void
    deleteEditHistoryEntry: (id: string) => void
    getFeatureHistory: (featureId: string) => EditHistoryEntry[]
    clearEditHistory: () => void
    fetchFeatureHistory: (id: string) => Promise<void>
    rollbackToHistory: (historyId: string) => Promise<void>

    // Feature CRUD
    addFeature: (feature: EditorFeature) => void
    updateFeature: (id: string, patch: Partial<EditorFeature>) => void
    /** Update feature without recording edit history (for preview/rollback) */
    silentUpdateFeature: (id: string, patch: Partial<EditorFeature>) => void
    deleteFeature: (id: string) => void
    removeFromProject: (id: string) => void
    removeClassFromProject: (fc: FeatureClass) => void
    duplicateFeature: (id: string) => EditorFeature | null
    setFeatures: (features: EditorFeature[]) => void
    clearFeatures: () => void
    
    setSearchResults: (results: EditorFeature[]) => void
    clearSearchResults: () => void

    // Feature Metadata
    updateFeatureMetadata: (id: string, key: string, value: any) => void

    // Layer management
    toggleLayerVisibility: (layerId: string) => void
    toggleLayerLock: (layerId: string) => void
    toggleLayerExpand: (layerId: string) => void
    rebuildLayers: () => void

    // Feature visibility / lock
    toggleFeatureVisibility: (id: string) => void
    toggleFeatureLock: (id: string) => void

    // History
    undo: () => void
    redo: () => void
    pushHistory: (entry: HistoryEntry) => void

    // Computed
    getSelectedFeature: () => EditorFeature | undefined
    getClassStyle: () => ClassStyle
}

// ─── Helper: generate layer id ─────────────────────────────
function layerId(fc: FeatureClass): string {
    return `layer-${fc}`
}

// ─── Store ─────────────────────────────────────────────────
export const useEditorStore = create<EditorState>()(
    persist(
        (set, get) => ({
            currentTool: 'select',
            featureClass: 'lake',

            features: [],
            selectedFeatureId: null,
            searchResults: [],

            layers: [],

            history: [],
            historyIndex: -1,

            mouseCoords: null,
            showMap: true,
            mapOpacity: 1.0,
            isLoading: false,
            editHistory: [],
            serverHistory: [],
            isGeometryDirty: false,
            // ─── Tool / Class ────────────────────────────────────────
            setTool: (tool) => set({ currentTool: tool }),
            setFeatureClass: (fc) => set({ featureClass: fc }),
            setSelectedFeature: (id) => set({ selectedFeatureId: id, isGeometryDirty: false }),
            setMouseCoords: (coords) => set({ mouseCoords: coords }),
            setShowMap: (show) => set({ showMap: show }),
            setMapOpacity: (opacity) => set({ mapOpacity: opacity }),
            setLoading: (loading) => set({ isLoading: loading }),
            setGeometryDirty: (dirty) => set({ isGeometryDirty: dirty }),
            addEditHistoryEntry: (entry) => set((s) => ({

                editHistory: [...s.editHistory, entry].slice(-100),
            })),
            deleteEditHistoryEntry: (id) => set((s) => ({
                editHistory: s.editHistory.filter((e) => e.id !== id),
            })),
            getFeatureHistory: (featureId) => {
                return get().editHistory.filter((e) => e.featureId === featureId)
            },
            clearEditHistory: () => set({ editHistory: [] }),

            fetchFeatureHistory: async (id) => {
                try {
                    const history = await apiService.getGeoObjectHistory(id)
                    set({ serverHistory: history })
                } catch (err) {
                    console.error('[editorStore] Failed to fetch feature history:', err)
                }
            },

            rollbackToHistory: async (historyId) => {
                try {
                    set({ isLoading: true })
                    await apiService.rollbackToHistory(historyId)
                    // After rollback, we should refresh the features
                    // This is usually handled by the parent component or a websocket
                    // For now, we'll just log success
                    console.log('[editorStore] Rollback successful')
                } catch (err) {
                    console.error('[editorStore] Failed to rollback to history:', err)
                    throw err
                } finally {
                    set({ isLoading: false })
                }
            },

            // ─── Feature CRUD ────────────────────────────────────────
            addFeature: (feature) => {
                set((s) => ({ features: [...s.features, feature] }))
                get().pushHistory({ type: 'add', featureId: feature.id, before: null, after: feature })
                get().addEditHistoryEntry({
                    id: crypto.randomUUID(),
                    featureId: feature.id,
                    featureName: feature.name,
                    action: 'create',
                    timestamp: Date.now(),
                    formattedDate: new Date().toLocaleString('ru-RU'),
                    user: 'user',
                    description: `Создан объект "${feature.name}"`,
                    beforeSnapshot: null,
                    afterSnapshot: { ...feature },
                })
                get().rebuildLayers()
            },

            updateFeature: (id, patch) => {
                const before = get().features.find((f) => f.id === id)
                set((s) => ({
                    features: s.features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
                    isGeometryDirty: patch.geometry ? true : s.isGeometryDirty,
                }))
                const after = get().features.find((f) => f.id === id)
                if (before && after) {
                    get().pushHistory({ type: 'update', featureId: id, before, after })
                }
                get().rebuildLayers()
            },

            silentUpdateFeature: (id, patch) => {
                set((s) => ({
                    features: s.features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
                }))
                get().rebuildLayers()
            },

            deleteFeature: (id) => {
                const before = get().features.find((f) => f.id === id)
                set((s) => ({
                    features: s.features.filter((f) => f.id !== id),
                    selectedFeatureId: s.selectedFeatureId === id ? null : s.selectedFeatureId,
                }))
                if (before) {
                    get().pushHistory({ type: 'delete', featureId: id, before, after: null })
                    get().addEditHistoryEntry({
                        id: crypto.randomUUID(),
                        featureId: id,
                        featureName: before.name,
                        action: 'delete',
                        timestamp: Date.now(),
                        formattedDate: new Date().toLocaleString('ru-RU'),
                        user: 'user',
                        description: `Удалён объект "${before.name}"`,
                        beforeSnapshot: { ...before },
                        afterSnapshot: null,
                    })
                }
                get().rebuildLayers()
            },

            removeFromProject: (id) => {
                set((s) => ({
                    features: s.features.filter((f) => f.id !== id),
                    selectedFeatureId: s.selectedFeatureId === id ? null : s.selectedFeatureId,
                }))
                get().rebuildLayers()
            },

            removeClassFromProject: (fc) => {
                set((s) => ({
                    features: s.features.filter((f) => f.featureClass !== fc),
                    selectedFeatureId: s.features.find(f => f.id === s.selectedFeatureId)?.featureClass === fc ? null : s.selectedFeatureId,
                }))
                get().rebuildLayers()
            },

            duplicateFeature: (id) => {
                const original = get().features.find((f) => f.id === id)
                if (!original) return null
                const newFeature: EditorFeature = {
                    ...original,
                    id: crypto.randomUUID(),
                    name: `${original.name} (copy)`,
                    backendId: undefined,
                }
                get().addFeature(newFeature)
                return newFeature
            },

            setFeatures: (features) => {
                set({ features })
                get().rebuildLayers()
            },
            clearFeatures: () => {
                set({ features: [], selectedFeatureId: null })
                get().rebuildLayers()
            },
            
            setSearchResults: (results) => set({ searchResults: results }),
            clearSearchResults: () => set({ searchResults: [] }),

            // ─── Feature Metadata ────────────────────────────────────
            updateFeatureMetadata: (id, key, value) => {
                const f = get().features.find((f) => f.id === id)
                if (!f) return
                const metadata = f.metadata || {}
                const updatedMetadata = { ...metadata, [key]: value }
                get().updateFeature(id, { metadata: updatedMetadata })
            },

            // ─── Layer management ────────────────────────────────────
            toggleLayerVisibility: (lid) => {
                set((s) => {
                    const layers = s.layers.map((l) =>
                        l.id === lid ? { ...l, visible: !l.visible } : l
                    )
                    const layer = layers.find((l) => l.id === lid)
                    if (!layer) return { layers }
                    // Sync features visibility
                    const features = s.features.map((f) =>
                        layer.featureIds.includes(f.id)
                            ? { ...f, visible: layer.visible }
                            : f
                    )
                    return { layers, features }
                })
            },

            toggleLayerLock: (lid) => {
                set((s) => {
                    const layers = s.layers.map((l) =>
                        l.id === lid ? { ...l, locked: !l.locked } : l
                    )
                    const layer = layers.find((l) => l.id === lid)
                    if (!layer) return { layers }
                    const features = s.features.map((f) =>
                        layer.featureIds.includes(f.id)
                            ? { ...f, locked: layer.locked }
                            : f
                    )
                    return { layers, features }
                })
            },

            toggleLayerExpand: (lid) => {
                set((s) => ({
                    layers: s.layers.map((l) =>
                        l.id === lid ? { ...l, expanded: !l.expanded } : l
                    ),
                }))
            },

            rebuildLayers: () => {
                const features = get().features
                const classMap = new Map<FeatureClass, string[]>()
                
                // Defined classes to always show
                const ALL_CLASSES: FeatureClass[] = ['lake', 'river', 'forest', 'road', 'building', 'city', 'other', 'custom']
                
                ALL_CLASSES.forEach(fc => classMap.set(fc, []))
                
                features.forEach((f) => {
                    const ids = classMap.get(f.featureClass) || []
                    ids.push(f.id)
                    classMap.set(f.featureClass, ids)
                })

                const existingLayers = get().layers
                const newLayers: LayerNode[] = []
                
                classMap.forEach((ids, fc) => {
                    const existing = existingLayers.find((l) => l.id === layerId(fc))
                    newLayers.push({
                        id: layerId(fc),
                        name: fc.charAt(0).toUpperCase() + fc.slice(1),
                        featureClass: fc,
                        visible: existing?.visible ?? true,
                        locked: existing?.locked ?? false,
                        expanded: existing?.expanded ?? true,
                        featureIds: ids,
                    })
                })
                set({ layers: newLayers })
            },

            // ─── Feature toggles ────────────────────────────────────
            toggleFeatureVisibility: (id) => {
                set((s) => ({
                    features: s.features.map((f) =>
                        f.id === id ? { ...f, visible: !f.visible } : f
                    ),
                }))
            },

            toggleFeatureLock: (id) => {
                set((s) => ({
                    features: s.features.map((f) =>
                        f.id === id ? { ...f, locked: !f.locked } : f
                    ),
                }))
            },

            // ─── Undo / Redo ────────────────────────────────────────
            pushHistory: (entry) => {
                set((s) => {
                    // Truncate any future entries after current index
                    const history = s.history.slice(0, s.historyIndex + 1)
                    history.push(entry)
                    // Keep max 50 entries
                    if (history.length > 50) history.shift()
                    return { history, historyIndex: history.length - 1 }
                })
            },

            undo: () => {
                const { history, historyIndex, features } = get()
                if (historyIndex < 0) return
                const entry = history[historyIndex]

                let newFeatures = [...features]
                switch (entry.type) {
                    case 'add':
                        newFeatures = newFeatures.filter((f) => f.id !== entry.featureId)
                        break
                    case 'delete':
                        if (entry.before) newFeatures.push(entry.before)
                        break
                    case 'update':
                        if (entry.before) {
                            newFeatures = newFeatures.map((f) =>
                                f.id === entry.featureId ? entry.before! : f
                            )
                        }
                        break
                }

                set({ features: newFeatures, historyIndex: historyIndex - 1 })
                get().rebuildLayers()
            },

            redo: () => {
                const { history, historyIndex, features } = get()
                if (historyIndex >= history.length - 1) return
                const entry = history[historyIndex + 1]

                let newFeatures = [...features]
                switch (entry.type) {
                    case 'add':
                        if (entry.after) newFeatures.push(entry.after)
                        break
                    case 'delete':
                        newFeatures = newFeatures.filter((f) => f.id !== entry.featureId)
                        break
                    case 'update':
                        if (entry.after) {
                            newFeatures = newFeatures.map((f) =>
                                f.id === entry.featureId ? entry.after! : f
                            )
                        }
                        break
                }

                set({ features: newFeatures, historyIndex: historyIndex + 1 })
                get().rebuildLayers()
            },

            // ─── Computed ────────────────────────────────────────────
            getSelectedFeature: () => {
                const { features, selectedFeatureId } = get()
                return features.find((f) => f.id === selectedFeatureId)
            },

            getClassStyle: () => {
                return CLASS_STYLES[get().featureClass]
            },
        }),
        {
            name: 'kzmap-editor-storage',
            partialize: (state) => ({
                currentTool: state.currentTool,
                featureClass: state.featureClass,
                selectedFeatureId: state.selectedFeatureId,
                showMap: state.showMap,
                mapOpacity: state.mapOpacity,
                features: state.features,
                editHistory: state.editHistory,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.rebuildLayers()
                }
            }
        }
    )
)
