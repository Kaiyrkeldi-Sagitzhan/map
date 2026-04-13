import { useState, useRef, useCallback, useEffect } from 'react'
import type { ObjectType } from '../../types'

interface ObjectDetailPanelProps {
    type: ObjectType
    mode: 'create' | 'edit'
    initialData?: {
        name: string
        description?: string
        metadata?: Record<string, unknown>
    }
    onSave: (data: ObjectFormData) => void
    onDelete?: () => void
    onCancel: () => void
}

export interface ObjectFormData {
    name: string
    description: string
    metadata: Record<string, unknown>
}

interface FormField {
    key: string
    label: string
    type: 'text' | 'number' | 'textarea' | 'select'
    placeholder?: string
    unit?: string
    options?: { value: string; label: string }[]
}

const typeFields: Record<ObjectType, FormField[]> = {
    river: [
        { key: 'length_km', label: 'Length', type: 'number', placeholder: '0', unit: 'km' },
        { key: 'avg_depth_m', label: 'Avg depth', type: 'number', placeholder: '0', unit: 'm' },
        { key: 'avg_width_m', label: 'Avg width', type: 'number', placeholder: '0', unit: 'm' },
        {
            key: 'flow_direction', label: 'Flow direction', type: 'select', options: [
                { value: '', label: 'Select...' },
                { value: 'north', label: 'North' }, { value: 'south', label: 'South' },
                { value: 'east', label: 'East' }, { value: 'west', label: 'West' },
                { value: 'northeast', label: 'Northeast' }, { value: 'northwest', label: 'Northwest' },
                { value: 'southeast', label: 'Southeast' }, { value: 'southwest', label: 'Southwest' },
            ]
        },
        {
            key: 'water_type', label: 'Water type', type: 'select', options: [
                { value: '', label: 'Select...' },
                { value: 'freshwater', label: 'Freshwater' },
                { value: 'saltwater', label: 'Saltwater' },
                { value: 'brackish', label: 'Brackish' },
            ]
        },
    ],
    lake: [
        { key: 'area_km2', label: 'Area', type: 'number', placeholder: '0', unit: 'km²' },
        { key: 'max_depth_m', label: 'Max depth', type: 'number', placeholder: '0', unit: 'm' },
        { key: 'avg_depth_m', label: 'Avg depth', type: 'number', placeholder: '0', unit: 'm' },
        {
            key: 'salinity', label: 'Salinity', type: 'select', options: [
                { value: '', label: 'Select...' },
                { value: 'freshwater', label: 'Freshwater' },
                { value: 'saltwater', label: 'Saltwater' },
                { value: 'brackish', label: 'Brackish' },
            ]
        },
        { key: 'volume_km3', label: 'Volume', type: 'number', placeholder: '0', unit: 'km³' },
    ],
    mountain: [
        { key: 'height_m', label: 'Height', type: 'number', placeholder: '0', unit: 'm' },
        { key: 'range', label: 'Mountain range', type: 'text', placeholder: 'e.g. Tian Shan' },
        { key: 'prominence_m', label: 'Prominence', type: 'number', placeholder: '0', unit: 'm' },
        { key: 'first_ascent', label: 'First ascent year', type: 'number', placeholder: 'e.g. 1956' },
    ],
    city: [
        { key: 'population', label: 'Population', type: 'number', placeholder: '0' },
        { key: 'founded', label: 'Founded year', type: 'number', placeholder: 'e.g. 1830' },
        { key: 'elevation_m', label: 'Elevation', type: 'number', placeholder: '0', unit: 'm' },
        { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'e.g. UTC+6' },
    ],
    road: [
        { key: 'length_km', label: 'Length', type: 'number', placeholder: '0', unit: 'km' },
        {
            key: 'road_type', label: 'Road type', type: 'select', options: [
                { value: '', label: 'Select...' },
                { value: 'highway', label: 'Highway' },
                { value: 'national', label: 'National road' },
                { value: 'regional', label: 'Regional road' },
                { value: 'local', label: 'Local road' },
            ]
        },
        {
            key: 'surface', label: 'Surface', type: 'select', options: [
                { value: '', label: 'Select...' },
                { value: 'asphalt', label: 'Asphalt' },
                { value: 'concrete', label: 'Concrete' },
                { value: 'gravel', label: 'Gravel' },
                { value: 'dirt', label: 'Dirt' },
            ]
        },
        { key: 'lanes', label: 'Lanes', type: 'number', placeholder: '2' },
    ],
    boundary: [
        {
            key: 'boundary_type', label: 'Boundary type', type: 'select', options: [
                { value: '', label: 'Select...' },
                { value: 'national', label: 'National border' },
                { value: 'regional', label: 'Regional border' },
                { value: 'district', label: 'District border' },
                { value: 'protected_area', label: 'Protected area' },
            ]
        },
        { key: 'established', label: 'Established year', type: 'number', placeholder: 'e.g. 1991' },
    ],
    forest: [
        { key: 'area_km2', label: 'Area', type: 'number', placeholder: '0', unit: 'km²' },
        { key: 'tree_type', label: 'Tree type', type: 'text', placeholder: 'e.g. coniferous' },
    ],
    building: [
        { key: 'levels', label: 'Levels', type: 'number', placeholder: '0' },
        { key: 'material', label: 'Material', type: 'text', placeholder: 'e.g. brick' },
    ],
    other: [
        { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. landmark, POI' },
    ],
}

// SVG icon for each type
const TypeIcon = ({ type, className = 'w-5 h-5' }: { type: ObjectType; className?: string }) => {
    const icons: Record<ObjectType, JSX.Element> = {
        river: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
                <path d="M2 18c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
            </svg>
        ),
        lake: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12c1-3 2-3 4 0s3 3 4 0" />
            </svg>
        ),
        mountain: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 22 21 2 21" />
                <polyline points="7 14 12 9 17 14" />
            </svg>
        ),
        city: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="9" width="4" height="12" />
                <rect x="10" y="5" width="4" height="16" />
                <rect x="17" y="12" width="4" height="9" />
                <line x1="1" y1="21" x2="23" y2="21" />
            </svg>
        ),
        road: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 21L5 3" />
                <path d="M16 21L19 3" />
                <line x1="12" y1="7" x2="12" y2="8" />
                <line x1="12" y1="12" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12" y2="18" />
            </svg>
        ),
        boundary: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 4 7 6" />
                <polyline points="3 18 5 20 7 18" />
                <line x1="5" y1="4" x2="5" y2="20" />
                <polyline points="17 6 19 4 21 6" />
                <polyline points="17 18 19 20 21 18" />
                <line x1="19" y1="4" x2="19" y2="20" />
                <line x1="5" y1="12" x2="19" y2="12" strokeDasharray="2 3" />
            </svg>
        ),
        forest: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 20 18 4 18" />
                <line x1="12" y1="18" x2="12" y2="22" />
            </svg>
        ),
        building: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" />
                <line x1="9" y1="6" x2="9" y2="6.01" />
                <line x1="15" y1="6" x2="15" y2="6.01" />
                <line x1="9" y1="10" x2="9" y2="10.01" />
                <line x1="15" y1="10" x2="15" y2="10.01" />
                <rect x="9" y="16" width="6" height="6" />
            </svg>
        ),
        other: (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2" />
                <circle cx="4" cy="12" r="2" />
                <circle cx="20" cy="12" r="2" />
            </svg>
        ),
    }
    return icons[type] ?? icons.other
}

const typeLabels: Record<ObjectType, string> = {
    river: 'River',
    lake: 'Lake',
    mountain: 'Mountain',
    city: 'City',
    road: 'Road',
    boundary: 'Boundary',
    forest: 'Forest',
    building: 'Building',
    other: 'Other',
}

const typeColors: Record<ObjectType, string> = {
    river: '#3b82f6',
    lake: '#0ea5e9',
    mountain: '#64748b',
    city: '#f59e0b',
    road: '#6b7280',
    boundary: '#10b981',
    forest: '#22c55e',
    building: '#8b5cf6',
    other: '#6366f1',
}

export default function ObjectDetailPanel({ type, mode, initialData, onSave, onDelete, onCancel }: ObjectDetailPanelProps) {
    const [name, setName] = useState(initialData?.name || `New ${type}`)
    const [description, setDescription] = useState(initialData?.description || '')
    const [meta, setMeta] = useState<Record<string, string>>(() => {
        if (!initialData?.metadata) return {}
        const m: Record<string, string> = {}
        Object.entries(initialData.metadata).forEach(([k, v]) => { m[k] = String(v ?? '') })
        return m
    })
    const [panelWidth, setPanelWidth] = useState(340)
    const isResizing = useRef(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const fields = typeFields[type] || []

    const updateMeta = (key: string, value: string) => setMeta(prev => ({ ...prev, [key]: value }))

    const handleSave = () => {
        const metadata: Record<string, unknown> = {}
        fields.forEach(field => {
            const val = meta[field.key]
            if (val !== undefined && val !== '') {
                metadata[field.key] = field.type === 'number' ? Number(val) : val
            }
        })
        onSave({ name, description, metadata })
    }

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        isResizing.current = true
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }, [])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return
            setPanelWidth(Math.max(280, Math.min(600, window.innerWidth - e.clientX)))
        }
        const handleMouseUp = () => {
            isResizing.current = false
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])

    const color = typeColors[type]

    return (
        <div
            ref={panelRef}
            className="absolute top-0 right-0 h-full bg-white border-l border-slate-200 shadow-2xl z-[1000] flex"
            style={{ width: panelWidth }}
        >
            {/* Resize handle */}
            <div
                onMouseDown={handleMouseDown}
                className="w-1.5 h-full cursor-col-resize bg-slate-200 hover:bg-emerald-400 transition-colors flex-shrink-0"
                title="Drag to resize"
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: color + '18', color }}
                        >
                            <TypeIcon type={type} className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800">{typeLabels[type]}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {mode === 'create' ? 'New object' : 'Edit object'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0 mt-0.5"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                            Name <span className="text-red-400 normal-case font-normal">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-colors"
                            placeholder="Object name"
                            autoFocus
                        />
                    </div>

                    {/* Type-specific fields */}
                    {fields.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</p>
                            {fields.map(field => (
                                <div key={field.key}>
                                    <label className="block text-xs text-slate-500 mb-1">
                                        {field.label}
                                        {field.unit && <span className="text-slate-400 ml-1">({field.unit})</span>}
                                    </label>
                                    {field.type === 'select' ? (
                                        <select
                                            value={meta[field.key] || ''}
                                            onChange={e => updateMeta(field.key, e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-colors"
                                        >
                                            {field.options?.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={field.type}
                                            value={meta[field.key] || ''}
                                            onChange={e => updateMeta(field.key, e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none transition-colors"
                                            placeholder={field.placeholder}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white outline-none resize-y transition-colors"
                            placeholder="Additional notes..."
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-100 space-y-2">
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-2.5 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!name.trim()}
                            className="flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            style={{ backgroundColor: color }}
                        >
                            {mode === 'create' ? 'Save' : 'Update'}
                        </button>
                    </div>
                    {mode === 'edit' && onDelete && (
                        <button
                            onClick={onDelete}
                            className="w-full py-2 px-4 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                                <path d="M9 6V4h6v2" />
                            </svg>
                            Delete Object
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
