import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Pencil, Layers, Globe } from 'lucide-react'
import { animate } from 'animejs'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import GlobeScene from './GlobeScene'
import type { GlobeHandle } from './GlobeScene'
import ParticleCanvas from './ParticleCanvas'
import AuthModal from './AuthModal'

gsap.registerPlugin(ScrollTrigger)

/* ── Component ───────────────────────────────────────────── */
export default function Landing() {
  const { isAuthenticated } = useAuth()
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null)
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

  if (isAuthenticated) return <Navigate to="/editor" replace />

  return (
    <div
      className="relative min-h-screen text-white overflow-hidden"
      style={{
        background: '#020C1B',
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
        className="fixed top-6 left-1/2 -translate-x-1/2 h-[70px] flex items-center justify-between px-10 w-[92%] max-w-7xl"
        style={{
          background: 'rgba(2, 12, 27, 0.5)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '100px',
          zIndex: 100,
          boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo: freshmap */}
        <div className="flex items-center select-none">
          <span
            className="text-[32px] font-normal tracking-wide text-[#10B981]"
            style={{ fontFamily: "'IM Fell Great Primer', serif" }}
          >
            freshmap
          </span>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setAuthMode('login')}
            className="text-xs font-bold uppercase tracking-[0.2em] text-[#10B981] hover:text-white transition-colors"
          >
            Access Terminal
          </button>
        </div>
      </header>

      {/* ─── HERO ──────────────────────────────────────────── */}
      <section className="h-screen flex flex-col items-center justify-center relative px-4 lg:px-8">
        <div
          ref={titleCardRef}
          className="relative px-16 py-12 md:px-24 md:py-20 border border-white/5"
          style={{
            zIndex: 5,
            transform: 'perspective(800px) rotateX(4deg)',
            transition: 'transform 0.15s ease-out',
            background: 'rgba(2, 12, 27, 0.5)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            borderRadius: '120px 20px 120px 20px',
            boxShadow: '0 30px 70px rgba(0,0,0,0.5)',
          }}
        >
          <h1
            ref={titleRef}
            className="text-center select-none text-white"
            style={{
              fontFamily: "'IM Fell Great Primer', serif",
              fontSize: 'clamp(3.5rem, 12vw, 10rem)',
              fontWeight: 400,
              lineHeight: 0.85,
              letterSpacing: '-0.03em',
              opacity: 0,
            }}
          >
            Kazakhstan
          </h1>
          <p className="text-center text-[#10B981] text-[10px] md:text-sm mt-10 tracking-[0.5em] uppercase font-black"
             style={{ fontFamily: 'Inter, sans-serif' }}>
            Topographic Mapping System
          </p>
        </div>
      </section>

      {/* ─── ABOUT ─────────────────────────────────────────── */}
      <section
        ref={aboutRef}
        className="min-h-[80vh] px-6 lg:px-20 py-40 relative flex flex-col items-center"
        style={{ zIndex: 2 }}
      >
        <div className="w-full max-w-7xl lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:gap-24 mb-32">
          <div
            className="scroll-reveal p-12 md:p-20 border border-white/5"
            style={{
              background: 'rgba(2, 12, 27, 0.7)',
              backdropFilter: 'blur(45px)',
              WebkitBackdropFilter: 'blur(45px)',
              borderRadius: '60px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
            }}
          >
            <h2
              className="text-6xl font-normal mb-14 text-[#10B981]"
              style={{ fontFamily: "'IM Fell Great Primer', serif" }}
            >
              О проекте
            </h2>

            <div className="text-slate-200 leading-[1.9] space-y-10 text-xl font-light">
              <p className="first-letter:text-6xl first-letter:font-serif first-letter:mr-3 first-letter:float-left first-letter:text-[#10B981] first-letter:leading-[1]">
                Проект <span className="text-[#10B981] font-semibold">freshmap</span> представляет собой 
                специализированную геоинформационную платформу, созданную для высокоточного картографирования 
                территории Казахстана. Мы объединили открытые данные OpenStreetMap с современными форматами 
                хранения GeoPackage, чтобы предоставить инструмент, не зависящий от проприетарных решений.
              </p>
              <p>
                Использование векторных тайлов PMTiles обеспечивает мгновенную визуализацию на любых масштабах, 
                от государственных границ до мельчайших архитектурных деталей. Это cloud-native подход, 
                минимизирующий нагрузку на сеть при сохранении безупречной четкости графики.
              </p>
              <p>
                Интерфейс редактирования позволяет пользователям создавать и модифицировать геометрию 
                объектов с полным сохранением топологической целостности. Все изменения фиксируются 
                в базе данных PostGIS, обеспечивая надежное хранение и возможность последующего анализа.
              </p>
            </div>
          </div>
          <div className="hidden lg:block" />
        </div>

        {/* Tools */}
        <div className="scroll-reveal grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl">
          <div className="group p-12 bg-white/[0.03] border border-white/5 hover:border-[#10B981] transition-all duration-700 backdrop-blur-xl rounded-[40px]">
            <Pencil className="w-12 h-12 text-[#10B981] mb-10 transition-transform group-hover:scale-110" />
            <h3 className="text-2xl font-medium mb-5 text-white">Геометрия</h3>
            <p className="text-slate-400 leading-relaxed text-lg">
              Высокоточное создание полигонов и линий с привязкой к координатной сетке для актуализации природных и техногенных объектов.
            </p>
          </div>
          <div className="group p-12 bg-white/[0.03] border border-white/5 hover:border-[#0077FF] transition-all duration-700 backdrop-blur-xl rounded-[40px]">
            <Layers className="w-12 h-12 text-[#0077FF] mb-10 transition-transform group-hover:scale-110" />
            <h3 className="text-2xl font-medium mb-5 text-white">Атрибуция</h3>
            <p className="text-slate-400 leading-relaxed text-lg">
              Гибкое управление семантическими данными: классификация объектов, настройка визуальных стилей и добавление метаданных.
            </p>
          </div>
          <div className="group p-12 bg-white/[0.03] border border-white/5 hover:border-[#10B981] transition-all duration-700 backdrop-blur-xl rounded-[40px]">
            <Globe className="w-12 h-12 text-[#10B981] mb-10 transition-transform group-hover:scale-110" />
            <h3 className="text-2xl font-medium mb-5 text-white">Интеграция</h3>
            <p className="text-slate-400 leading-relaxed text-lg">
              Экспорт данных в индустриальные форматы GeoJSON и PMTiles для бесшовного использования в профессиональных ГИС-системах.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────── */}
      <footer
        className="pb-20 pt-10 flex flex-col items-center justify-center relative"
        style={{ zIndex: 2 }}
      >
        <div 
          className="flex flex-col items-center gap-12 p-16 w-[92%] max-w-7xl border border-white/5 shadow-2xl"
          style={{
            background: 'rgba(2, 12, 27, 0.6)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderRadius: '60px',
          }}
        >
          <button
            onClick={() => setAuthMode('login')}
            className="px-16 py-5 border border-[#10B981] text-[#10B981] text-xl font-bold hover:bg-[#10B981] hover:text-[#020C1B] transition-all duration-700 rounded-full tracking-widest uppercase"
          >
            Terminal Start
          </button>
          
          <div className="text-center">
            <p className="text-[10px] text-[#10B981] tracking-[0.6em] uppercase mb-4 font-black">
              Global Topography
            </p>
            <p className="text-3xl text-white font-normal" style={{ fontFamily: "'IM Fell Great Primer', serif" }}>
              freshmap team
            </p>
          </div>
        </div>
      </footer>

      {authMode && (
        <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSwitchMode={(m) => setAuthMode(m)} />
      )}
    </div>
  )
}
