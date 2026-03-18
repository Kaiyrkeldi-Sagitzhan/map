/**
 * ViewerToolbar.tsx — Floating toolbar for the viewer with type filter dropdown.
 */
import { useState, useRef, useEffect } from 'react'
import { useViewerStore } from '../../store/viewerStore'
import { getSafeStyle } from '../../types/editor'
import {
    MousePointer2,
    Focus,
    History,
    AlertCircle,
    Eye,
    EyeOff,
    ChevronDown
} from 'lucide-react'

const VIEWER_TYPES = [
    { value: '', label: 'Все типы', color: '#6b7280' },
    { value: 'lake', label: 'Озёра' },
    { value: 'river', label: 'Реки' },
    { value: 'forest', label: 'Леса' },
    { value: 'road', label: 'Дороги' },
    { value: 'building', label: 'Здания' },
    { value: 'city', label: 'Нас. пункты' },
    { value: 'other', label: 'Другое' },
]

export default function ViewerToolbar() {
    const { showMap, setShowMap, activeTool, setActiveTool, featureClassFilter, setFeatureClassFilter } = useViewerStore()
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

    const toolBtn = (tool: typeof activeTool, icon: React.ReactNode, title: string, isComplaint = false) => {
        const active = activeTool === tool
        return (
            <button
                onClick={() => setActiveTool(active ? 'select' : tool)}
                title={title}
                className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                    active
                    ? isComplaint
                        ? 'bg-amber-500 text-[#020C1B] shadow-[0_8px_16px_rgba(245,158,11,0.3)]'
                        : 'bg-[#10B981] text-[#020C1B] shadow-[0_8px_16px_rgba(16,185,129,0.3)]'
                    : isComplaint
                        ? 'text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
                {icon}
            </button>
        )
    }

    const currentType = VIEWER_TYPES.find(t => t.value === featureClassFilter) || VIEWER_TYPES[0]
    const dotColor = featureClassFilter ? getSafeStyle(featureClassFilter).fillColor : '#6b7280'

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[5000] flex items-center gap-2 pointer-events-auto">
            {/* Main toolbar pill */}
            <div className="flex items-center gap-0.5 bg-[#020C1B]/80 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10 p-1.5">
                {toolBtn('select', <MousePointer2 size={18} />, 'Выделение')}
                {toolBtn('searchArea', <Focus size={18} />, 'Область поиска (Shift — прямоугольник)')}
                {toolBtn('history', <History size={18} />, 'История объекта')}

                {/* Divider */}
                <div className="w-px h-6 bg-white/10 mx-1.5" />

                {toolBtn('complaint', <AlertCircle size={18} />, 'Подать жалобу', true)}

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

                {/* Divider */}
                <div className="w-px h-6 bg-white/10 mx-1.5" />

                {/* Type filter dropdown */}
                <div className="relative" ref={classMenuRef}>
                    <button
                        onClick={() => setShowClassMenu(!showClassMenu)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                            showClassMenu
                                ? 'bg-white/10 text-white'
                                : featureClassFilter
                                    ? 'text-white bg-white/5'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <div
                            className="w-3 h-3 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: dotColor }}
                        />
                        <span className="hidden sm:inline">{currentType.label}</span>
                        <ChevronDown size={14} className={`transition-transform duration-200 ${showClassMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showClassMenu && (
                        <div className="absolute bottom-full mb-3 right-0 bg-[#020C1B] rounded-2xl shadow-2xl border border-white/10 py-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="px-4 py-2 mb-1 border-b border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Тип объекта</span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar px-1">
                                {VIEWER_TYPES.map((vt) => (
                                    <button
                                        key={vt.value}
                                        onClick={() => {
                                            setFeatureClassFilter(vt.value)
                                            setShowClassMenu(false)
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all duration-150 ${
                                            featureClassFilter === vt.value
                                                ? 'bg-[#10B981]/10 text-[#10B981]'
                                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full border border-white/10 shadow-sm"
                                            style={{ backgroundColor: vt.color || getSafeStyle(vt.value).fillColor }}
                                        />
                                        <span>{vt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tooltips */}
            {activeTool === 'complaint' && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 bg-amber-500/90 text-[#020C1B] rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                    Нажмите на объект для жалобы
                </div>
            )}
            {activeTool === 'searchArea' && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 bg-[#10B981]/90 text-[#020C1B] rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                    Кликайте для полигона · Shift+drag для прямоугольника · Dbl-click завершить
                </div>
            )}
        </div>
    )
}
