/**
 * ViewerToolbar.tsx — Floating toolbar for the viewer.
 */
import { useViewerStore } from '../../store/viewerStore'
import {
    MousePointer2,
    Ruler,
    Focus,
    History,
    AlertCircle,
    Eye,
    EyeOff
} from 'lucide-react'

const AREA_LAYER_OPTIONS = [
    { id: 'lake', label: 'Озера' },
    { id: 'river', label: 'Реки' },
    { id: 'forest', label: 'Леса' },
    { id: 'road', label: 'Дороги' },
]

export default function ViewerToolbar() {
    const {
        showMap,
        setShowMap,
        activeTool,
        setActiveTool,
        searchAreaLayers,
        toggleSearchAreaLayer,
        resetSearchAreaLayers,
    } = useViewerStore()

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

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[5000] pointer-events-auto">
            <div className="relative w-fit">
            {/* Main toolbar pill */}
            <div className="flex items-center gap-0.5 bg-[#020C1B] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10 p-1.5">
                {toolBtn('select', <MousePointer2 size={18} />, 'Выделение')}
                {toolBtn('measure', <Ruler size={18} />, 'Линейка (ПКМ или ESC — сброс)')}
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
            </div>

            {/* Tooltips */}
            {activeTool === 'complaint' && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 bg-amber-500/90 text-[#020C1B] rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                    Нажмите на объект для жалобы
                </div>
            )}
            {activeTool === 'searchArea' && (
                <div className="absolute bottom-full mb-3 left-0 w-full bg-[#020C1B]/95 border border-white/10 rounded-2xl shadow-2xl p-3 origin-bottom animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Поиск по площади</span>
                        <button
                            onClick={resetSearchAreaLayers}
                            className="text-[8px] font-bold uppercase tracking-wider text-[#10B981] hover:text-white transition-colors"
                        >
                            Все слои
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {AREA_LAYER_OPTIONS.map((layer) => {
                            const enabled = searchAreaLayers.has(layer.id)
                            return (
                                <button
                                    key={layer.id}
                                    onClick={() => toggleSearchAreaLayer(layer.id)}
                                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg border transition-all ${enabled ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'}`}
                                >
                                    <span className="text-[9px] font-bold uppercase tracking-wide">{layer.label}</span>
                                    <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-[#10B981]' : 'bg-slate-600'}`} />
                                </button>
                            )
                        })}
                    </div>
                    <div className="mt-2 text-[8px] text-slate-500 uppercase tracking-wider">
                        Кликайте для полигона · Shift+drag для прямоугольника · Dbl-click завершить
                    </div>
                </div>
            )}
            {activeTool === 'measure' && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 bg-[#10B981]/90 text-[#020C1B] rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                    Кликайте по точкам · ПКМ или ESC сброс
                </div>
            )}
            </div>
        </div>
    )
}
