/**
 * Editor-specific types for the Figma-like vector map editor.
 */

// ─── Draw Tools ────────────────────────────────────────────
export type DrawTool =
    | 'select'
    | 'drawPolygon'
    | 'drawRectangle'
    | 'drawCircle'
    | 'drawLine'
    | 'freehand'
    | 'marker'
    | 'searchArea'

// ─── Feature Classes ───────────────────────────────────────
export type FeatureClass =
    | 'lake'
    | 'river'
    | 'forest'
    | 'road'
    | 'building'
    | 'region'
    | 'custom'

export interface ClassStyle {
    color: string       // stroke color
    fillColor: string   // fill color
    weight: number      // stroke width
    fillOpacity: number // fill transparency
}

/** Preset styles for each feature class */
export const CLASS_STYLES: Record<FeatureClass, ClassStyle> = {
    lake: { color: '#0369a1', fillColor: '#0ea5e9', weight: 1.5, fillOpacity: 0.6 },
    river: { color: '#0369a1', fillColor: '#38bdf8', weight: 2.5, fillOpacity: 0.5 },
    forest: { color: '#166534', fillColor: '#22c55e', weight: 1, fillOpacity: 0.5 },
    road: { color: '#0f172a', fillColor: 'transparent', weight: 3, fillOpacity: 0 },
    building: { color: '#4c1d95', fillColor: '#8b5cf6', weight: 1, fillOpacity: 0.5 },
    region: { color: '#334155', fillColor: '#94a3b8', weight: 2, fillOpacity: 0.1 },
    custom: { color: '#4338ca', fillColor: '#6366f1', weight: 1.5, fillOpacity: 0.5 },
}

export function getSafeStyle(fc: string): ClassStyle {
    return CLASS_STYLES[fc as FeatureClass] || CLASS_STYLES.custom
}

export const CLASS_LABELS: Record<FeatureClass, string> = {
    lake: 'Озера',
    river: 'Река',
    forest: 'Лес',
    road: 'Дорога',
    building: 'Здание',
    region: 'Область',
    custom: 'Все объекты (Разведка)',
}

export function getSafeLabel(fc: string): string {
    return CLASS_LABELS[fc as FeatureClass] || 'Объект'
}

// ─── Editor Feature (wraps GeoJSON Feature) ────────────────
export interface EditorFeature {
    id: string
    name: string
    featureClass: FeatureClass
    description: string
    style: ClassStyle
    visible: boolean
    locked: boolean
    geometry: GeoJSON.Geometry
    /** Backend ID if persisted, undefined for new unsaved features */
    backendId?: string
}

// ─── Layer Tree Node ───────────────────────────────────────
export interface LayerNode {
    id: string
    name: string
    featureClass: FeatureClass
    visible: boolean
    locked: boolean
    expanded: boolean
    featureIds: string[]
}

// ─── History Entry ─────────────────────────────────────────
export interface HistoryEntry {
    type: 'add' | 'update' | 'delete'
    featureId: string
    before: EditorFeature | null
    after: EditorFeature | null
}

// ─── Mouse Coordinates ─────────────────────────────────────
export interface MouseCoords {
    lat: number
    lng: number
}
