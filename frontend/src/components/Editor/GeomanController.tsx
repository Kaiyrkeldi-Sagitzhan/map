/**
 * GeomanController.tsx — Thin wrapper component to invoke useGeoman hook inside MapContainer.
 * React-leaflet hooks (useMap) must be called inside MapContainer's children.
 */
import { useEffect } from 'react'
import { useGeoman } from '../../hooks/useGeoman'
import { useEditorStore } from '../../store/editorStore'

export default function GeomanController() {
    const { loadVisibleObjects } = useGeoman()

    useEffect(() => {
        useEditorStore.getState().setLoadVisibleObjects(loadVisibleObjects)
        return () => {
            useEditorStore.getState().setLoadVisibleObjects(null)
        }
    }, [loadVisibleObjects])

    return null
}
