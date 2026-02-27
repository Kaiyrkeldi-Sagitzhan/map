import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import GlobeGL from 'globe.gl'

export interface GlobeHandle {
  flyTo: (lat: number, lng: number, altitude: number, ms: number) => void
}

const GlobeScene = forwardRef<GlobeHandle, { width: number; height: number }>(
  ({ width, height }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const globe = useRef<any>(null)

    useImperativeHandle(ref, () => ({
      flyTo(lat, lng, altitude, ms) {
        globe.current?.pointOfView({ lat, lng, altitude }, ms)
      },
    }))

    useEffect(() => {
      if (!containerRef.current || globe.current) return

      const g = (GlobeGL as any)()(containerRef.current)
        .globeTileEngineUrl(
          (x: number, y: number, l: number) =>
            `https://tile.openstreetmap.org/${l}/${x}/${y}.png`
        )
        .width(width)
        .height(height)
        .backgroundColor('rgba(0,0,0,0)')
        .showAtmosphere(true)
        .atmosphereColor('#4dc9f6')
        .atmosphereAltitude(0.2) // slightly higher atmosphere for 'distanced' feel

      g.pointOfView({ lat: 48, lng: 67, altitude: 5.0 }, 0) // start much further away

      const c = g.controls()
      c.autoRotate = false
      c.enableZoom = false
      c.enablePan = false
      c.enableRotate = true
      c.rotateSpeed = 0.4

      // Return to Kazakhstan after user stops dragging
      let returnTimer: number
      c.addEventListener('start', () => clearTimeout(returnTimer))
      c.addEventListener('end', () => {
        returnTimer = window.setTimeout(() => {
          g.pointOfView({ lat: 48, lng: 67, altitude: 1.8 }, 2500)
        }, 3000)
      })

      globe.current = g
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      globe.current?.width(width).height(height)
    }, [width, height])

    return <div ref={containerRef} style={{ overflow: 'visible' }} />
  }
)

GlobeScene.displayName = 'GlobeScene'
export default GlobeScene
