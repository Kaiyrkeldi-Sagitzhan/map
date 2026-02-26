import React, { useState, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'

const NotesWidget: React.FC = () => {
    const selectedFeature = useEditorStore((s) => s.getSelectedFeature())
    const updateFeature = useEditorStore((s) => s.updateFeature)
    const [note, setNote] = useState('')

    useEffect(() => {
        setNote(selectedFeature?.description || '')
    }, [selectedFeature?.id])

    const handleSave = () => {
        if (selectedFeature) {
            updateFeature(selectedFeature.id, { description: note })
        }
    }

    return (
        <div className="absolute bottom-16 left-4 z-[1000] w-64 bg-white/90 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 p-3 pointer-events-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                <span>Notes & Properties</span>
                {selectedFeature && (
                   <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                       {selectedFeature.featureClass}
                   </span>
                )}
            </h3>
            
            {selectedFeature ? (
                <div className="space-y-3">
                    <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Name</label>
                        <input 
                            type="text"
                            value={selectedFeature.name}
                            onChange={(e) => updateFeature(selectedFeature.id, { name: e.target.value })}
                            className="w-full text-sm bg-transparent border-b border-gray-200 focus:border-indigo-500 outline-none pb-1"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Description</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            onBlur={handleSave}
                            placeholder="Add notes about this object..."
                            className="w-full text-sm bg-gray-50 rounded p-2 border border-gray-100 focus:border-indigo-300 outline-none resize-none h-24"
                        />
                    </div>
                </div>
            ) : (
                <div className="py-4 text-center text-gray-400 text-sm italic">
                    Select an object on the map to see its details.
                </div>
            )}
        </div>
    )
}

export default NotesWidget
