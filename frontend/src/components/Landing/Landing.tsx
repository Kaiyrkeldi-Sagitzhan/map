import { useState, useEffect, useRef, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Pencil, Layers, Globe, Github, Linkedin } from 'lucide-react'
import { animate } from 'animejs'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import GlobeScene from './GlobeScene'
import type { GlobeHandle } from './GlobeScene'
import ParticleCanvas from './ParticleCanvas'
import AuthModal from './AuthModal'

gsap.registerPlugin(ScrollTrigger)

/* ── Screenshot placeholders ─────────────────────────────── */
const SCREENSHOTS = [
  { src: new URL('../../assets/example_images/example1.png', import.meta.url).href, caption: 'Интерфейс редактирования рек' },
  { src: new URL('../../assets/example_images/example2.png', import.meta.url).href, caption: 'Панель свойств объекта' },
  { src: new URL('../../assets/example_images/example3.png', import.meta.url).href, caption: 'Слои и группировка' },
  { src: new URL('../../assets/example_images/example4.png', import.meta.url).href, caption: 'Экспорт данных в GeoJSON' },
  { src: new URL('../../assets/example_images/example5.png', import.meta.url).href, caption: 'Поиск по координатам' },
  { src: new URL('../../assets/example_images/example6.png', import.meta.url).href, caption: 'Рисование полигонов' },
]

/* ── Component ───────────────────────────────────────────── */
export default function Landing() {
  const { isAuthenticated } = useAuth()
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null)
  const [logoChar, setLogoChar] = useState('c')
  const [globeSize, setGlobeSize] = useState(() =>
    Math.max(window.innerWidth, window.innerHeight) * 1.5
  )

  const aboutRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleCardRef = useRef<HTMLDivElement>(null)
  const globeWrapRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeHandle>(null)

  /* ── Responsive globe size ───────────────────────────────── */
  useEffect(() => {
    const onResize = () =>
      setGlobeSize(Math.max(window.innerWidth, window.innerHeight) * 1.5)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* ── Logo: simple c/C toggle every 2s ────────────────────── */
  useEffect(() => {
    const interval = setInterval(() => {
      setLogoChar(prev => prev === 'c' ? 'C' : 'c')
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  /* ── Title fade-in ───────────────────────────────────────── */
  useEffect(() => {
    if (!titleRef.current) return
    animate(titleRef.current, {
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 1200,
      delay: 600,
      ease: 'outQuad',
    })
  }, [])

  /* ── Title card 3D parallax on mouse ─────────────────────── */
  useEffect(() => {
    const card = titleCardRef.current
    if (!card) return
    const onMove = (e: MouseEvent) => {
      const rx = (e.clientY / window.innerHeight - 0.5) * -8
      const ry = (e.clientX / window.innerWidth - 0.5) * 12
      card.style.transform =
        `perspective(800px) rotateX(${4 + rx}deg) rotateY(${ry}deg)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  /* ── GSAP: scroll reveals + globe scroll animation ───────── */
  useEffect(() => {
    const section = aboutRef.current
    const globeEl = globeWrapRef.current
    if (!section) return

    const els = section.querySelectorAll('.scroll-reveal')
    els.forEach((el, i) => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        opacity: 0,
        y: 40,
        duration: 0.7,
        delay: i * 0.12,
        ease: 'power2.out',
      })
    })

    if (globeEl) {
      gsap.set(globeEl, { xPercent: -50, yPercent: -50 })

      // Move globe UP and RIGHT (to show the map while text is on the left)
      gsap.to(globeEl, {
        top: '50%',
        left: '72%',
        ease: 'power1.inOut',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'top 20%',
          scrub: 1,
        },
      })

      // Zoom to Astana on scroll down, reset on scroll back up
      ScrollTrigger.create({
        trigger: section,
        start: 'top 60%',
        onEnter: () => {
          globeRef.current?.flyTo(51.1694, 71.4491, 0.05, 3500)
        },
        onLeaveBack: () => {
          globeRef.current?.flyTo(48, 67, 5.0, 2500)
        },
      })

      // Fade out near footer
      gsap.to(globeEl, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'bottom 80%',
          end: 'bottom 30%',
          scrub: 1,
        },
      })
    }

    return () => ScrollTrigger.getAll().forEach((t) => t.kill())
  }, [])

  /* ── Header button glow ──────────────────────────────────── */
  const glowHandlers = useCallback(() => ({
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 10px rgba(255,215,0,0.5)'
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
    },
  }), [])

  if (isAuthenticated) return <Navigate to="/editor" replace />

  return (
    <div
      className="relative min-h-screen text-white"
      style={{
        background: 'linear-gradient(180deg, #0A192F 0%, #020C1B 100%)',
        scrollBehavior: 'smooth',
      }}
    >
      <ParticleCanvas />

      {/* ─── GLOBE ─────────────────────────────────────────── */}
      <div
        ref={globeWrapRef}
        className="fixed"
        style={{
          left: '50%',
          top: '100%',
          width: globeSize,
          height: globeSize,
          zIndex: 1,
          overflow: 'visible',
        }}
      >
        <GlobeScene ref={globeRef} width={globeSize} height={globeSize} />
      </div>

      {/* ─── HEADER ────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 h-[60px] flex items-center justify-between px-8"
        style={{
          background: 'rgba(10,25,47,0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 100,
        }}
      >
        {/* Logo: PacKZ / PaCKZ */}
        <div className="flex items-center select-none">
          <span
            className="text-[32px] font-bold tracking-tight"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <span className="text-[#FFD700]">Pa{logoChar}</span>
            <span className="text-white">KZ</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAuthMode('login')}
            className="px-5 py-2 border border-[#FFD700] text-white rounded-lg hover:bg-[#FFD700] hover:text-[#0A192F] transition-all duration-300 text-sm font-medium"
            {...glowHandlers()}
          >
            Войти
          </button>
          <button
            onClick={() => setAuthMode('register')}
            className="px-5 py-2 border border-[#FFD700] text-white rounded-lg hover:bg-[#FFD700] hover:text-[#0A192F] transition-all duration-300 text-sm font-medium"
            {...glowHandlers()}
          >
            Регистрация
          </button>
        </div>
      </header>

      {/* ─── HERO ──────────────────────────────────────────── */}
      <section className="h-screen flex flex-col items-center justify-center relative px-4 lg:px-8">
        <div
          ref={titleCardRef}
          className="relative rounded-2xl px-10 py-8 md:px-16 md:py-12 border border-white/10"
          style={{
            background: 'rgba(10, 25, 47, 0.55)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            zIndex: 5,
            transform: 'perspective(800px) rotateX(4deg)',
            transition: 'transform 0.15s ease-out',
          }}
        >
          <h1
            ref={titleRef}
            className="text-center select-none text-white"
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 'clamp(2.5rem, 8vw, 6.5rem)',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              opacity: 0,
            }}
          >
            MAP Kazakhstan
          </h1>
          <p className="text-center text-slate-300/80 text-sm md:text-base mt-4 tracking-wide"
             style={{ fontFamily: 'Inter, sans-serif' }}>
            Топографический редактор карт на базе OpenStreetMap
          </p>
        </div>
      </section>

      {/* ─── ABOUT ─────────────────────────────────────────── */}
      <section
        ref={aboutRef}
        className="min-h-[80vh] px-6 lg:px-20 py-24 relative"
        style={{ zIndex: 2 }}
      >
        <div className="lg:grid lg:grid-cols-[1fr_1fr] lg:gap-16 mb-16">
          {/* Description in glass panel */}
          <div
            className="scroll-reveal rounded-2xl p-8 md:p-10 border border-white/10"
            style={{
              background: 'rgba(10, 25, 47, 0.55)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <h2
              className="text-4xl font-bold mb-8"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              О проекте
            </h2>

            <div className="text-slate-300 leading-relaxed space-y-4 text-[15px]">
              <p>
                PacKZ это специализированный геоинформационный инструмент для
                актуализации и создания топографических карт территории Казахстана.
                В основе проекта лежит интеграция данных OpenStreetMap с форматом
                хранения GeoPackage, что обеспечивает работу с актуальными
                пространственными данными без привязки к проприетарным решениям.
              </p>
              <p>
                Система поддерживает векторные тайлы в формате PMTiles — компактном,
                cloud-native контейнере, оптимизированном для HTTP Range Requests.
                Это позволяет реализовать бесконечный зум от масштаба страны до уровня
                отдельных зданий без предварительной генерации растровых тайлов.
              </p>
              <p>
                Редактирование геометрии реализовано на базе Leaflet и плагина
                leaflet-geoman: пользователь может создавать полигоны, линии и
                точечные объекты с полным контролем над атрибутами. Каждый объект
                хранится в PostGIS с привязкой к пользователю.
              </p>
              <p>
                Экспорт доступен в форматах GeoJSON, SVG и PNG — для интеграции с
                настольными ГИС (QGIS, ArcGIS), для публикаций и печати.
              </p>
            </div>
          </div>
          {/* Right: space for globe */}
          <div className="hidden lg:block" />
        </div>

        {/* Tools */}
        <div className="scroll-reveal grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          <div className="flex items-start gap-3 p-5 rounded-xl bg-slate-900/40 backdrop-blur-md border border-white/10 hover:bg-white/[0.06] transition-all duration-300 shadow-xl">
            <Pencil className="w-6 h-6 text-[#FFD700] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1 text-white">Рисование полигонов</h3>
              <p className="text-sm text-white">
                Точное создание контуров озёр, лесных массивов и
                административных границ с привязкой к координатам.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-5 rounded-xl bg-slate-900/40 backdrop-blur-md border border-white/10 hover:bg-white/[0.06] transition-all duration-300 shadow-xl">
            <Layers className="w-6 h-6 text-[#00BFFF] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1 text-white">Панель свойств</h3>
              <p className="text-sm text-white">
                Редактирование цвета, толщины линий, прозрачности заливки и
                текстовых описаний для каждого объекта на карте.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-5 rounded-xl bg-slate-900/40 backdrop-blur-md border border-white/10 hover:bg-white/[0.06] transition-all duration-300 shadow-xl">
            <Globe className="w-6 h-6 text-[#FFD700] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1 text-white">Экспорт</h3>
              <p className="text-sm text-white">
                GeoJSON, SVG и PNG для интеграции с QGIS, ArcGIS, для
                публикаций и печати актуализированных карт.
              </p>
            </div>
          </div>
        </div>

        {/* Screenshots */}
        <div className="scroll-reveal grid grid-cols-2 md:grid-cols-3 gap-4">
          {SCREENSHOTS.map((s, i) => (
            <div
              key={i}
              className="group relative aspect-video rounded-xl overflow-hidden border border-white/[0.06] cursor-pointer transition-all duration-300 hover:scale-[1.04]"
              style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0d1b2a 100%)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(0,191,255,0.2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
            >
              <img src={s.src} alt={s.caption} className="w-full h-full object-cover" loading="lazy"
                onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                <span className="text-sm text-white/90">{s.caption}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────── */}
      <footer
        className="min-h-[20vh] flex flex-col items-center justify-center gap-5 border-t border-white/[0.06] relative"
        style={{ background: '#0A192F', zIndex: 2 }}
      >
        <div className="flex items-center gap-5">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            className="text-[#FFD700] hover:rotate-[360deg] transition-transform duration-700">
            <Github className="w-6 h-6" />
          </a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"
            className="text-[#FFD700] hover:rotate-[360deg] transition-transform duration-700">
            <Linkedin className="w-6 h-6" />
          </a>
        </div>
        <button
          onClick={() => setAuthMode('login')}
          className="px-8 py-3 bg-[#FFD700] text-[#0A192F] font-bold rounded-lg transition-transform duration-300 landing-pulse-gold"
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          Начать работу
        </button>
        <p className="text-sm text-slate-500" style={{ fontFamily: 'Inter, sans-serif' }}>
          &copy; 2026 Anuar
        </p>
      </footer>

      {authMode && (
        <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSwitchMode={(m) => setAuthMode(m)} />
      )}
    </div>
  )
}
