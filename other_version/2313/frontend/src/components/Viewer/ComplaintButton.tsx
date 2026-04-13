import { AlertCircle } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'

const ComplaintButton = () => {
    const { activeTool, setActiveTool } = useViewerStore()
    const isActive = activeTool === 'complaint'

    return (
        <button
            onClick={() => setActiveTool(isActive ? 'select' : 'complaint')}
            className={`
                absolute top-24 right-6 z-[5000] flex items-center gap-3 px-5 py-3 rounded-2xl
                font-bold uppercase tracking-[0.15em] text-[10px] transition-all duration-300
                shadow-[0_15px_35px_rgba(0,0,0,0.4)] border
                ${isActive 
                    ? 'bg-amber-500 text-[#020C1B] border-amber-400 shadow-amber-500/30 scale-105' 
                    : 'bg-[#020C1B]/80 backdrop-blur-2xl text-amber-500 border-white/10 hover:bg-amber-500/10 hover:border-amber-500/40'
                }
            `}
        >
            <AlertCircle size={16} className={isActive ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">{isActive ? 'Выберите объект на карте...' : 'Подать жалобу'}</span>
            <span className="sm:hidden">{isActive ? '...' : 'Жалоба'}</span>
            
            {!isActive && (
                <div className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </div>
            )}
        </button>
    )
}

export default ComplaintButton
