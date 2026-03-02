/**
 * Toolbar.tsx — Figma-style floating bottom toolbar.
 * Pill-shaped, centered at bottom, with tool buttons and class dropdown.
 */
import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { DrawTool, FeatureClass } from '../../types/editor'
import { CLASS_LABELS, CLASS_STYLES } from '../../types/editor'

// ─── Tool definitions ──────────────────────────────────────
interface ToolDef {
    id: DrawTool
    label: string
    icon: JSX.Element
}

const tools: ToolDef[] = [
    {
        id: 'select',
        label: 'Выделение',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="M13 13l6 6" />
            </svg>
        ),
    },
    {
        id: 'drawPolygon',
        label: 'Полигон',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l9 7-3.5 11h-11L3 9z" />
            </svg>
        ),
    },
    {
        id: 'drawRectangle',
        label: 'Прямоугольник',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
            </svg>
        ),
    },
    {
        id: 'drawCircle',
        label: 'Круг',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
            </svg>
        ),
    },
    {
        id: 'drawLine',
        label: 'Линия',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="19" x2="19" y2="5" />
            </svg>
        ),
    },
    {
        id: 'freehand',
        label: 'Свободная линия',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17c2-2 4-6 7-6s3 4 5 4 3-3 5-5" />
            </svg>
        ),
    },
    {
        id: 'marker',
        label: 'Маркер',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
            </svg>
        ),
    },
    {
        id: 'searchArea',
        label: 'Область поиска',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <rect x="2" y="2" width="18" height="18" rx="2" strokeDasharray="4,2" />
            </svg>
        ),
    },
]

const featureClasses: FeatureClass[] = ['lake', 'river', 'forest', 'road', 'building', 'city', 'other', 'custom']

export default function Toolbar() {
    const { currentTool, setTool, featureClass, setFeatureClass, showMap, setShowMap } = useEditorStore()
    const [showClassMenu, setShowClassMenu] = useState(false)
    const classMenuRef = useRef<HTMLDivElement>(null)

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (classMenuRef.current && !classMenuRef.current.contains(e.target as Node)) {
                setShowClassMenu(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
            switch (e.key.toLowerCase()) {
                case 'v': setTool('select'); break
                case 'p': setTool('drawPolygon'); break
                case 'r': setTool('drawRectangle'); break
                case 'o': setTool('drawCircle'); break
                case 'l': setTool('drawLine'); break
                case 'f': setTool('freehand'); break
                case 'm': setTool('marker'); break
                case 's': setTool('searchArea'); break
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [setTool])

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1">
            {/* Main toolbar pill */}
            <div className="flex items-center gap-0.5 bg-white rounded-full shadow-2xl shadow-black/20 border border-gray-200/60 px-2 py-1.5">
                {tools.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => setTool(tool.id)}
                        title={tool.label}
                        className={`
              relative flex items-center justify-center w-10 h-10 rounded-full
              transition-all duration-200 ease-out
              ${currentTool === tool.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }
            `}
                    >
                        {tool.icon}
                        {currentTool === tool.id && (
                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                        )}
                    </button>
                ))}

                {/* Divider */}
                <div className="w-px h-8 bg-gray-200 mx-1.5" />

                <button
                    onClick={() => setShowMap(!showMap)}
                    title={showMap ? "Скрыть подложку" : "Показать подложку"}
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                        showMap ? 'text-gray-600 hover:bg-gray-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                    }`}
                >
                    {showMap ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                    )}
                </button>

                <button
                    onClick={() => {
                        if (confirm('Очистить все объекты с карты?')) {
                            useEditorStore.getState().clearFeatures()
                        }
                    }}
                    title="Очистить карту"
                    className="flex items-center justify-center w-10 h-10 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                </button>

                {/* Divider */}
                <div className="w-px h-8 bg-gray-200 mx-1.5" />

                {/* Class dropdown */}
                <div className="relative" ref={classMenuRef}>
                    <button
                        onClick={() => setShowClassMenu(!showClassMenu)}
                        className={`
              flex items-center gap-2 px-3 py-2 rounded-full
              text-sm font-medium transition-all duration-200
              ${showClassMenu
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }
            `}
                    >
                        <span
                            className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: CLASS_STYLES[featureClass].fillColor }}
                        />
                        <span>{CLASS_LABELS[featureClass]}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {/* Dropdown menu */}
                    {showClassMenu && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl shadow-black/15 border border-gray-200/60 py-2 min-w-[180px]">
                            {featureClasses.map((fc) => (
                                <button
                                    key={fc}
                                    onClick={() => {
                                        setFeatureClass(fc)
                                        setShowClassMenu(false)
                                    }}
                                    className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-sm
                    transition-colors duration-150
                    ${featureClass === fc
                                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }
                  `}
                                >
                                    <span
                                        className="w-4 h-4 rounded-full border-2 shadow-sm"
                                        style={{
                                            backgroundColor: CLASS_STYLES[fc].fillColor,
                                            borderColor: CLASS_STYLES[fc].color,
                                        }}
                                    />
                                    <span>{CLASS_LABELS[fc]}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
