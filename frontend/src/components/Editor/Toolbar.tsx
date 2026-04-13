/**
 * Toolbar.tsx — Figma-style floating bottom toolbar.
 * Pill-shaped, centered at bottom, with tool buttons and class dropdown.
 */
import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { DrawTool, FeatureClass } from '../../types/editor'
import { CLASS_LABELS, CLASS_STYLES } from '../../types/editor'
import { 
    MousePointer2, 
    Ruler,
    Hexagon, 
    Square, 
    Circle, 
    Minus, 
    PenTool, 
    MapPin, 
    Focus, 
    Edit3, 
    History,
    Eye,
    EyeOff,
    Trash2,
    ChevronDown
} from 'lucide-react'

// ─── Tool definitions ──────────────────────────────────────
interface ToolDef {
    id: DrawTool
    label: string
    icon: JSX.Element
}

const tools: ToolDef[] = [
    {
        id: 'select',
        label: 'Выделение (V)',
        icon: <MousePointer2 size={18} />,
    },
    {
        id: 'measure',
        label: 'Линейка (D)',
        icon: <Ruler size={18} />,
    },
    {
        id: 'drawPolygon',
        label: 'Полигон (P)',
        icon: <Hexagon size={18} />,
    },
    {
        id: 'drawRectangle',
        label: 'Прямоугольник (R)',
        icon: <Square size={18} />,
    },
    {
        id: 'drawCircle',
        label: 'Круг (O)',
        icon: <Circle size={18} />,
    },
    {
        id: 'drawLine',
        label: 'Линия (L)',
        icon: <Minus size={18} />,
    },
    {
        id: 'freehand',
        label: 'Свободная линия (F)',
        icon: <PenTool size={18} />,
    },
    {
        id: 'marker',
        label: 'Маркер (M)',
        icon: <MapPin size={18} />,
    },
    {
        id: 'searchArea',
        label: 'Область поиска (S)',
        icon: <Focus size={18} />,
    },
    {
        id: 'edit',
        label: 'Редактировать',
        icon: <Edit3 size={18} />,
    },
    {
        id: 'history',
        label: 'История',
        icon: <History size={18} />,
    },
]

const featureClasses: FeatureClass[] = ['lake', 'river', 'forest', 'road', 'other', 'custom']

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

            // Ctrl+Z / Ctrl+Shift+Z for undo/redo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault()
                if (e.shiftKey) {
                    useEditorStore.getState().redo()
                } else {
                    useEditorStore.getState().undo()
                }
                return
            }

            switch (e.key.toLowerCase()) {
                case 'v': setTool('select'); break
                case 'd': setTool('measure'); break
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
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2">
            {/* Main toolbar pill */}
            <div className="flex items-center gap-0.5 bg-[#020C1B]/80 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10 p-1.5">
                {tools.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => setTool(tool.id)}
                        title={tool.label}
                        className={`
                            relative flex items-center justify-center w-10 h-10 rounded-xl
                            transition-all duration-200 ease-out
                            ${currentTool === tool.id
                                ? 'bg-[#10B981] text-[#020C1B] shadow-[0_8px_16px_rgba(16,185,129,0.3)]'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        {tool.icon}
                    </button>
                ))}

                {/* Divider */}
                <div className="w-px h-6 bg-white/10 mx-1.5" />

                <button
                    onClick={() => setShowMap(!showMap)}
                    title={showMap ? "Скрыть подложку" : "Показать подложку"}
                    className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                        showMap ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20'
                    }`}
                >
                    {showMap ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>

                <button
                    onClick={() => {
                        if (confirm('Очистить все объекты с карты?')) {
                            useEditorStore.getState().clearFeatures()
                        }
                    }}
                    title="Очистить карту"
                    className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                    <Trash2 size={18} />
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-white/10 mx-1.5" />

                {/* Class dropdown */}
                <div className="relative" ref={classMenuRef}>
                    <button
                        onClick={() => setShowClassMenu(!showClassMenu)}
                        className={`
                            flex items-center gap-2.5 px-3 py-2 rounded-xl
                            text-[11px] font-bold uppercase tracking-wider transition-all duration-200
                            ${showClassMenu
                                ? 'bg-white/10 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: CLASS_STYLES[featureClass].fillColor }}
                        />
                        <span className="hidden sm:inline">{CLASS_LABELS[featureClass]}</span>
                        <ChevronDown size={14} className={`transition-transform duration-200 ${showClassMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown menu */}
                    {showClassMenu && (
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#020C1B]/95 backdrop-blur-3xl rounded-2xl shadow-2xl border border-white/10 py-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="px-4 py-2 mb-1 border-b border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Тип объекта</span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar px-1">
                                {featureClasses.map((fc) => (
                                    <button
                                        key={fc}
                                        onClick={() => {
                                            setFeatureClass(fc)
                                            setShowClassMenu(false)
                                        }}
                                        className={`
                                            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wide
                                            transition-all duration-150
                                            ${featureClass === fc
                                                ? 'bg-[#10B981]/10 text-[#10B981]'
                                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }
                                        `}
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full border border-white/10 shadow-sm"
                                            style={{
                                                backgroundColor: CLASS_STYLES[fc].fillColor,
                                            }}
                                        />
                                        <span>{CLASS_LABELS[fc]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
