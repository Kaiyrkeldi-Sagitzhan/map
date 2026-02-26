/**
 * Type declarations for leaflet-geoman-free.
 * Extends Leaflet's Map and Layer types with geoman methods.
 */
import 'leaflet'

declare module 'leaflet' {
    interface Map {
        pm: PM.PMMap
    }

    interface Layer {
        pm: PM.PMLayer
    }

    namespace PM {
        interface PMMap {
            addControls(options?: any): void
            removeControls(): void
            enableDraw(shape: string, options?: any): void
            disableDraw(): void
            enableGlobalEditMode(options?: any): void
            disableGlobalEditMode(): void
            enableGlobalDragMode(): void
            disableGlobalDragMode(): void
            enableGlobalRemovalMode(): void
            disableGlobalRemovalMode(): void
            setGlobalOptions(options: any): void
            getGeomanLayers(): Layer[]
            getGeomanDrawLayers(): Layer[]
            globalDrawModeEnabled(): boolean
            globalEditModeEnabled(): boolean
            globalDragModeEnabled(): boolean
            globalRemovalModeEnabled(): boolean
        }

        interface PMLayer {
            enable(options?: any): void
            disable(): void
            toggleEdit(options?: any): void
            enabled(): boolean
            hasSelfIntersection(): boolean
            remove(): void
            getShape(): string
        }
    }
}

declare module '@geoman-io/leaflet-geoman-free' {
    // Module is imported for side effects (extends L)
}
