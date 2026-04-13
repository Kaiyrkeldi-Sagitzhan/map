/**
 * GeomanController.tsx — Thin wrapper component to invoke useGeoman hook inside MapContainer.
 * React-leaflet hooks (useMap) must be called inside MapContainer's children.
 */
import { useGeoman } from '../../hooks/useGeoman'

export default function GeomanController() {
    useGeoman()
    return null
}
