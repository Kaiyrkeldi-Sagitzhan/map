import { useState, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { getSafeStyle, getSafeLabel } from '../../types/editor'
import type { FeatureClass } from '../../types/editor'
import {
    Download,
    Layers,
    Trash2,
    ChevronRight,
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Hexagon,
    Minus,
    MapPin,
    ExternalLink,
    XCircle,
} from 'lucide-react'

const DISABLED_TYPES = new Set(['building', 'city'])

export default function LayersPanel() {
    const {
        layers,
        features,
        selectedFeatureId,
        setSelectedFeature,
        toggleLayerExpand,
        toggleFeatureVisibility,
        toggleFeatureLock,
        mapOpacity,
        setMapOpacity,
        removeFromProject,
        removeClassFromProject,
    } = useEditorStore()

    const [isCollapsed, setIsCollapsed] = useState(false)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'layer' | 'feature', id: string, fc?: FeatureClass } | null>(null)

    useEffect(() => {
        const hide = () => setContextMenu(null)
        const handleWindowContextMenu = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.context-menu-trigger')) hide()
        }

        window.addEventListener('click', hide)
        window.addEventListener('contextmenu', handleWindowContextMenu)
        return () => {
            window.removeEventListener('click', hide)
            window.removeEventListener('contextmenu', handleWindowContextMenu)
        }
    }, [])

    const handleContextMenu = (e: React.MouseEvent, type: 'layer' | 'feature', id: string, fc?: FeatureClass) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, type, id, fc })
    }

    const visibleLayers = layers.filter((l) => !DISABLED_TYPES.has(l.featureClass))

    return (
        <>
            <div className={`fixed top-28 left-6 z-[500] bg-[#020C1B]/75 backdrop-blur-3xl border border-white/10 flex flex-col overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)] transition-all duration-300 ${isCollapsed ? 'w-12 h-12 rounded-xl' : 'w-[300px] h-[40vh] rounded-[24px]'}`}>
                <div className={`${isCollapsed ? 'p-0 h-full' : 'p-3 border-b border-white/5 bg-white/[0.02]'} flex items-center justify-between`}>
                    <button
                        onClick={() => setIsCollapsed((v) => !v)}
                        className={`${isCollapsed ? 'w-full h-full flex items-center justify-center text-slate-300 hover:text-white' : 'flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] hover:text-white'} transition-colors`}
                    >
                        {isCollapsed ? (
                            <Layers size={16} className="text-[#10B981]" />
                        ) : (
                            <>
                                <ChevronRight size={14} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                                <Layers size={14} className="text-[#10B981]" />
                                Слои
                            </>
                        )}
                    </button>
                    <button className={`${isCollapsed ? 'hidden' : 'p-2'} text-slate-400 hover:text-[#10B981] hover:bg-white/5 rounded-lg transition-all`} title="Экспорт проекта">
                        <Download size={16} />
                    </button>
                </div>

                {!isCollapsed && (
                    <>
                        <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.1em]">Прозрачность карты</span>
                                <span className="text-[10px] font-mono text-[#10B981]">{Math.round(mapOpacity * 100)}%</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.01" value={mapOpacity} onChange={(e) => setMapOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#10B981]" />
                        </div>

                        <div className="flex-1 overflow-y-auto py-2 px-2 custom-scrollbar">
                            {visibleLayers.map((layer) => {
                                const layerFeatures = features.filter((f) => f.featureClass === layer.featureClass && !DISABLED_TYPES.has(f.featureClass))
                                return (
                                    <div key={layer.id} className="mb-1">
                                        <div
                                            className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition-all context-menu-trigger ${!layer.visible ? 'opacity-40' : ''}`}
                                            onClick={() => toggleLayerExpand(layer.id)}
                                            onContextMenu={(e) => handleContextMenu(e, 'layer', layer.id, layer.featureClass)}
                                        >
                                            <ChevronRight size={14} className={`text-slate-600 transition-transform duration-200 ${layer.expanded ? 'rotate-90 text-white' : ''}`} />
                                            <div className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: getSafeStyle(layer.featureClass).fillColor }} />
                                            <span className="flex-1 text-[11px] font-bold text-slate-200 truncate uppercase tracking-wide">{getSafeLabel(layer.featureClass)}</span>
                                            <span className="text-[9px] text-slate-500 font-bold bg-white/5 px-2 py-0.5 rounded-md group-hover:bg-[#10B981]/10 group-hover:text-[#10B981] transition-colors">{layerFeatures.length}</span>
                                        </div>
                                        {layer.expanded && (
                                            <div className="mt-0.5 ml-4 border-l border-white/5 pl-2 space-y-px">
                                                {[...layerFeatures].reverse().map((feature) => (
                                                    <FeatureItem
                                                        key={feature.id}
                                                        feature={feature}
                                                        isSelected={feature.id === selectedFeatureId}
                                                        onSelect={() => setSelectedFeature(feature.id)}
                                                        onToggleVisibility={() => toggleFeatureVisibility(feature.id)}
                                                        onToggleLock={() => toggleFeatureLock(feature.id)}
                                                        onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, 'feature', feature.id)}
                                                        onRemove={() => removeFromProject(feature.id)}
                                                    />
                                                ))}
                                                {layerFeatures.length === 0 && (
                                                    <div className="py-2 px-3 text-[10px] text-slate-600 italic">Слой пуст</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="px-5 py-3 border-t border-white/5 bg-black/20">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{features.filter((f) => !DISABLED_TYPES.has(f.featureClass)).length} объектов</span>
                        </div>
                    </>
                )}
            </div>

            {contextMenu && (
                <div
                    className="fixed z-[10000] min-w-[180px] bg-[#0A192F]/95 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-xl py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    {contextMenu.type === 'layer' ? (
                        <button
                            onClick={() => {
                                if (contextMenu.fc) removeClassFromProject(contextMenu.fc)
                                setContextMenu(null)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <XCircle size={14} /> Убрать все объекты слоя
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    removeFromProject(contextMenu.id)
                                    setContextMenu(null)
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/5 transition-colors"
                            >
                                <ExternalLink size={14} /> Убрать из проекта
                            </button>
                            <button
                                onClick={() => {
                                    const state = useEditorStore.getState()
                                    state.deleteFeature(contextMenu.id)
                                    setContextMenu(null)
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5 mt-1 pt-2"
                            >
                                <Trash2 size={14} /> Удалить навсегда
                            </button>
                        </>
                    )}
                </div>
            )}
        </>
    )
}

function FeatureItem({ feature, isSelected, onSelect, onToggleVisibility, onToggleLock, onRemove, onContextMenu }: any) {
    const updateFeature = useEditorStore((s) => s.updateFeature)
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(feature.name)

    const geoType = feature.geometry?.type || ''
    let geoIcon = <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getSafeStyle(feature.featureClass).fillColor }} />
    if (geoType.includes('Polygon')) geoIcon = <Hexagon size={10} className="text-slate-500" />
    else if (geoType.includes('Line')) geoIcon = <Minus size={10} className="text-slate-500" />
    else if (geoType.includes('Point')) geoIcon = <MapPin size={10} className="text-slate-500" />

    return (
        <div
            className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all border context-menu-trigger ${isSelected ? 'bg-[#10B981]/10 border-[#10B981]/20' : 'hover:bg-white/5 border-transparent'}`}
            onClick={onSelect}
            onContextMenu={onContextMenu}
        >
            <div className="shrink-0 w-4 flex justify-center">{geoIcon}</div>

            {editing ? (
                <input
                    className="flex-1 text-[11px] bg-white/10 border border-[#10B981]/40 rounded px-1.5 py-0.5 text-white outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => { updateFeature(feature.id, { name }); setEditing(false) }}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                />
            ) : (
                <span className={`flex-1 text-[11px] truncate transition-colors ${isSelected ? 'text-white font-bold' : 'text-slate-400 group-hover:text-slate-200'}`} onDoubleClick={() => setEditing(true)}>{feature.name}</span>
            )}

            <div className={`flex items-center gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); onToggleVisibility() }} className={`p-1 rounded hover:bg-white/10 transition-colors ${feature.visible ? 'text-slate-500' : 'text-amber-500'}`}>
                    {feature.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onToggleLock() }} className={`p-1 rounded hover:bg-white/10 transition-colors ${feature.locked ? 'text-amber-500' : 'text-slate-500'}`}>
                    {feature.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="p-1 rounded hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    )
}
