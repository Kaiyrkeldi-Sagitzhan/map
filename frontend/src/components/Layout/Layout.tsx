import { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { LogOut } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAdmin, logout } = useAuth()

  return (
    <div className="h-screen overflow-hidden bg-[#020C1B]">
      {/* Floating Header Island */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 h-[60px] flex items-center justify-between px-8 w-[96%] max-w-[1800px] z-[1000]"
        style={{
          background: 'rgba(2, 12, 27, 0.6)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '100px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo: freshmap */}
        <div className="flex items-center select-none">
          <span
            className="text-[24px] font-normal tracking-wide text-[#10B981]"
            style={{ fontFamily: "'IM Fell Great Primer', serif" }}
          >
            freshmap
          </span>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-xs font-medium opacity-60">{user?.email}</span>
            {isAdmin && (
              <span className="px-2 py-0.5 text-[9px] font-bold bg-[#10B981]/10 text-[#10B981] rounded-full border border-[#10B981]/20 uppercase tracking-widest">
                Admin
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-[#10B981] transition-colors uppercase tracking-widest"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        </div>
      </header>

      {/* Main Content — no padding top needed as header is floating */}
      <main className="h-full overflow-hidden">
        {children}
      </main>
    </div>
  )
}
