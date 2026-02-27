import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

/* ── Cities ──────────────────────────────────────────────── */
interface City {
  name: string
  lat: number
  lon: number
}

const CITIES: City[] = [
  { name: 'Астана',     lat: 51.16,  lon: 71.47 },
  { name: 'Алматы',     lat: 43.25,  lon: 76.92 },
  { name: 'Шымкент',    lat: 42.32,  lon: 69.60 },
  { name: 'Караганда',  lat: 49.80,  lon: 73.10 },
  { name: 'Актобе',     lat: 50.30,  lon: 57.17 },
  { name: 'Атырау',     lat: 47.10,  lon: 51.92 },
]

/* ── Constants ───────────────────────────────────────────── */
const WS_URL = 'ws://localhost:9870'
const ZOOM_START = 5
const ZOOM_END = 12
const ZOOM_STEP_MS = 900

/* ── Pac-Man overlay types ───────────────────────────────── */
interface PacmanEntity {
  x: number
  y: number
  speed: number
  direction: 1 | -1
  frame: number
}

/* ── Fallback ASCII content ──────────────────────────────── */
function writeFallback(term: Terminal) {
  const cyan = '\x1b[36m'
  const yellow = '\x1b[33m'
  const dim = '\x1b[2m'
  const bold = '\x1b[1m'
  const reset = '\x1b[0m'
  const green = '\x1b[32m'

  const lines = [
    '',
    `${cyan}${bold}  ╔═══════════════════════════════════════════════════╗${reset}`,
    `${cyan}${bold}  ║         ${yellow}PacKZ${cyan} — MapSCII Terminal View           ║${reset}`,
    `${cyan}${bold}  ╚═══════════════════════════════════════════════════╝${reset}`,
    '',
    `${dim}  Connecting to MapSCII WebSocket server...${reset}`,
    '',
    `${yellow}  ⚠  Server is not running.${reset}`,
    '',
    `${dim}  To start the map server:${reset}`,
    '',
    `${green}  ┌──────────────────────────────────────┐${reset}`,
    `${green}  │  cd mapscii-server                   │${reset}`,
    `${green}  │  npm install                          │${reset}`,
    `${green}  │  npm start                            │${reset}`,
    `${green}  └──────────────────────────────────────┘${reset}`,
    '',
    `${dim}  The terminal will display an interactive ASCII map`,
    `  of Kazakhstan rendered from OpenStreetMap data`,
    `  using MapSCII with Braille characters.${reset}`,
    '',
    `${cyan}           ____`,
    `          /    \\____`,
    `         /  ${yellow}Kazakhstan${cyan}  \\____`,
    `        /    /\\      /\\     \\`,
    `       |   /  \\    /  \\     \\___`,
    `       |  /    \\__/    \\        |`,
    `        \\/              \\_____/ ${reset}`,
    '',
    `${dim}  Waiting for connection on ${WS_URL}...${reset}`,
  ]

  for (const line of lines) {
    term.write(line + '\r\n')
  }
}

/* ── Component ───────────────────────────────────────────── */
export default function MapSciiTerminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const zoomTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pacmanCanvasRef = useRef<HTMLCanvasElement>(null)
  const pacmanRafRef = useRef(0)

  const [selectedCity, setSelectedCity] = useState(0)
  const [connected, setConnected] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(ZOOM_START)
  const [showPacman, setShowPacman] = useState(false)

  /* ── Pac-Man overlay animation ─────────────────────────── */
  const startPacmanAnimation = useCallback(() => {
    const canvas = pacmanCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.parentElement?.getBoundingClientRect()
    if (rect) {
      canvas.width = rect.width
      canvas.height = rect.height
    }

    const pacmans: PacmanEntity[] = [
      { x: 0,   y: canvas.height * 0.2,  speed: 1.4, direction: 1,  frame: 0 },
      { x: canvas.width, y: canvas.height * 0.45, speed: 1.1, direction: -1, frame: 10 },
      { x: 100, y: canvas.height * 0.7,  speed: 1.7, direction: 1,  frame: 5 },
      { x: canvas.width - 200, y: canvas.height * 0.35, speed: 0.9, direction: -1, frame: 15 },
    ]

    const DOT_SPACING = 18
    const DOT_R = 1.5
    const PM_SIZE = 13

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const pm of pacmans) {
        pm.x += pm.speed * pm.direction
        pm.frame++

        // Wrap
        if (pm.direction === 1 && pm.x > canvas.width + 20) pm.x = -20
        if (pm.direction === -1 && pm.x < -20) pm.x = canvas.width + 20

        // Dots in the pac-man's row
        for (let dx = 0; dx < canvas.width; dx += DOT_SPACING) {
          const dist = Math.abs(dx - pm.x)
          if (dist > PM_SIZE + 4) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'
            ctx.beginPath()
            ctx.arc(dx, pm.y, DOT_R, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // Pac-Man character
        const mouthOpen = Math.floor(pm.frame / 12) % 2 === 0
        ctx.font = `bold ${PM_SIZE}px Consolas, "Courier New", monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#FFD700'

        if (mouthOpen) {
          ctx.save()
          if (pm.direction === -1) {
            ctx.scale(-1, 1)
            ctx.fillText('C', -pm.x, pm.y)
          } else {
            ctx.fillText('C', pm.x, pm.y)
          }
          ctx.restore()
        } else {
          ctx.fillText('\u25CF', pm.x, pm.y)
        }
      }

      pacmanRafRef.current = requestAnimationFrame(draw)
    }

    pacmanRafRef.current = requestAnimationFrame(draw)
  }, [])

  /* ── Connect to MapSCII via WebSocket ──────────────────── */
  const connect = useCallback((city: City) => {
    // Cleanup previous session
    if (wsRef.current) { try { wsRef.current.close() } catch {} }
    if (terminalRef.current) terminalRef.current.dispose()
    if (zoomTimerRef.current) clearInterval(zoomTimerRef.current)
    cancelAnimationFrame(pacmanRafRef.current)
    setShowPacman(false)
    setZoomLevel(ZOOM_START)
    setConnected(false)

    const term = new Terminal({
      theme: {
        background: '#000000',
        foreground: '#00FF00',
        cursor: '#00FF00',
        cursorAccent: '#000000',
      },
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: 9,
      lineHeight: 1.0,
      cursorBlink: false,
      cursorStyle: 'underline',
      scrollback: 0,
      disableStdin: false,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)

    if (containerRef.current) {
      containerRef.current.innerHTML = ''
      term.open(containerRef.current)
      // Multiple fit() passes to ensure the terminal fills the container
      requestAnimationFrame(() => {
        fit.fit()
        setTimeout(() => fit.fit(), 100)
        setTimeout(() => fit.fit(), 300)
      })
    }

    terminalRef.current = term
    fitRef.current = fit

    // Attempt WebSocket connection
    const ws = new WebSocket(
      `${WS_URL}?lat=${city.lat}&lon=${city.lon}&zoom=${ZOOM_START}&cols=${term.cols}&rows=${term.rows}`
    )
    ws.binaryType = 'arraybuffer'

    const connectTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close()
        setConnected(false)
        writeFallback(term)
      }
    }, 4000)

    ws.onopen = () => {
      clearTimeout(connectTimeout)
      setConnected(true)

      // Start zoom-in animation
      let currentZoom = ZOOM_START
      zoomTimerRef.current = setInterval(() => {
        if (currentZoom < ZOOM_END) {
          ws.send('a') // MapSCII zoom-in key
          currentZoom++
          setZoomLevel(currentZoom)
        } else {
          if (zoomTimerRef.current) clearInterval(zoomTimerRef.current)
          setShowPacman(true)
        }
      }, ZOOM_STEP_MS)
    }

    ws.onmessage = (event) => {
      const data = event.data
      if (typeof data === 'string') {
        term.write(data)
      } else {
        term.write(new Uint8Array(data))
      }
    }

    // Forward user keyboard input to MapSCII
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    ws.onerror = () => {
      clearTimeout(connectTimeout)
      setConnected(false)
      writeFallback(term)
    }

    ws.onclose = () => {
      setConnected(false)
    }

    wsRef.current = ws
  }, [])

  /* ── Lifecycle ─────────────────────────────────────────── */
  useEffect(() => {
    connect(CITIES[selectedCity])

    const onResize = () => {
      if (fitRef.current) fitRef.current.fit()
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      if (wsRef.current) try { wsRef.current.close() } catch {}
      if (terminalRef.current) terminalRef.current.dispose()
      if (zoomTimerRef.current) clearInterval(zoomTimerRef.current)
      cancelAnimationFrame(pacmanRafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity])

  /* Start pac-man when flag flips */
  useEffect(() => {
    if (showPacman) startPacmanAnimation()
    return () => cancelAnimationFrame(pacmanRafRef.current)
  }, [showPacman, startPacmanAnimation])

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="relative w-full h-full">
      {/* Terminal */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: '#000' }}
      />

      {/* Pac-Man overlay canvas */}
      {showPacman && (
        <canvas
          ref={pacmanCanvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 5 }}
        />
      )}

      {/* Subtle CRT flicker overlay */}
      {showPacman && (
        <div
          className="absolute inset-0 pointer-events-none landing-terminal-flicker"
          style={{ zIndex: 4 }}
        />
      )}

      {/* City selector */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2" style={{ zIndex: 10 }}>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(Number(e.target.value))}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-black/70 text-[#00BFFF] border border-[#00BFFF]/40 backdrop-blur-sm focus:outline-none focus:border-[#00BFFF] cursor-pointer appearance-none pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2300BFFF' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          {CITIES.map((city, i) => (
            <option key={city.name} value={i}>
              {city.name} [{city.lat}, {city.lon}]
            </option>
          ))}
        </select>
      </div>

      {/* Connection + Zoom indicator */}
      <div className="absolute top-2 right-3 flex items-center gap-3 text-xs font-mono" style={{ zIndex: 10 }}>
        {connected ? (
          <>
            <span className="flex items-center gap-1 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
            <span className="text-[#00BFFF]">zoom: {zoomLevel}</span>
          </>
        ) : (
          <span className="text-yellow-500">OFFLINE</span>
        )}
      </div>
    </div>
  )
}
