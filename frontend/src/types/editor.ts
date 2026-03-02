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
    | 'city'
    | 'other'
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
    city: { color: '#f59e0b', fillColor: '#fbaf17', weight: 2, fillOpacity: 0.3 },
    other: { color: '#6366f1', fillColor: '#818cf8', weight: 1.5, fillOpacity: 0.4 },
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
    city: 'Населенный пункт',
    other: 'Точки интереса',
    custom: 'Все объекты',
}

export function getSafeLabel(fc: string): string {
    return CLASS_LABELS[fc as FeatureClass] || 'Объект'
}

/** 
 * Advanced Cartography Engine 
 * Calculates style based on feature class and OSM metadata (fclass, bridge, etc.)
 */
export function getAdvancedStyle(featureClass: FeatureClass, metadata: any = {}, baseStyle?: ClassStyle) {
    const meta = metadata || {}
    const fclass = meta.fclass || ''
    const fallback = baseStyle || CLASS_STYLES[featureClass] || CLASS_STYLES.custom
    
    let color = fallback.color
    let fillColor = fallback.fillColor
    let weight = fallback.weight
    let fillOpacity = fallback.fillOpacity
    let dashArray: string | undefined = undefined

    // 1. Smart Road Styling
    if (featureClass === 'road') {
        switch(fclass) {
            case 'motorway': color = '#f59e0b'; weight = 7; break;
            case 'trunk':
            case 'primary': color = '#fbbf24'; weight = 5; break;
            case 'secondary': color = '#fcd34d'; weight = 3.5; break;
            case 'tertiary': color = '#fde68a'; weight = 2.5; break;
            case 'residential': color = '#cbd5e1'; weight = 1.2; break;
            case 'rail':
            case 'railway': color = '#475569'; weight = 2; dashArray = '5, 5'; break;
            default: color = '#94a3b8'; weight = 1;
        }
        if (meta.bridge === 'T') weight += 2
        if (meta.tunnel === 'T') { dashArray = '3, 3'; color = '#cbd5e1' }
    } 
    
    // 2. Smart Building Styling
    else if (featureClass === 'building') {
        fillOpacity = 0.8
        switch(fclass) {
            case 'apartments':
            case 'residential': fillColor = '#e2e8f0'; break;
            case 'industrial':
            case 'warehouse': fillColor = '#cbd5e1'; break;
            case 'commercial':
            case 'retail': fillColor = '#ffedd5'; break;
            case 'school':
            case 'hospital': fillColor = '#fee2e2'; break;
            default: fillColor = '#f1f5f9';
        }
    }

    // 3. Smart Water/Forest/City
    else if (featureClass === 'lake' && fclass === 'reservoir') {
        fillColor = '#0369a1'
    } else if (featureClass === 'city') {
        fillColor = 'transparent'
        fillOpacity = 0.05
        weight = 1
        color = '#f59e0b'
        dashArray = '10, 5'
    }

    return { color, fillColor, weight, fillOpacity, dashArray }
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
    /** Additional OSM data like fclass */
    metadata?: Record<string, any>
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
