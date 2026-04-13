import { ReactNode, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Settings, LayoutDashboard, ArrowLeftCircle } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [isImpersonating, setIsImpersonating] = useState(false)

  useEffect(() => {
    setIsImpersonating(!!sessionStorage.getItem('admin_token'))
  }, [user])

  const handleReturnToAdmin = () => {
    const adminToken = sessionStorage.getItem('admin_token')
    const adminUserRaw = sessionStorage.getItem('admin_user')
    if (adminToken && adminUserRaw) {
      const adminUser = JSON.parse(adminUserRaw)
      localStorage.setItem('token', adminToken)
      localStorage.setItem('user', adminUserRaw)
      sessionStorage.removeItem('admin_token')
      sessionStorage.removeItem('admin_user')
      updateUser(adminUser)
      navigate('/admin/users')
    }
  }

  // Display name: prefer nickname > first_name > email
  const displayName = user?.nickname || user?.first_name || user?.email || ''

  return (
    <div className="h-screen overflow-hidden bg-[#020C1B]">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 h-8 z-[1100] flex items-center justify-center gap-3"
          style={{ background: 'linear-gradient(90deg, #F59E0B, #D97706)', boxShadow: '0 2px 10px rgba(245,158,11,0.3)' }}
        >
          <span className="text-xs font-semibold text-black">
            Вы вошли как {displayName}
          </span>
          <button
            onClick={handleReturnToAdmin}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/20 hover:bg-black/30 text-black transition-colors"
          >
            <ArrowLeftCircle className="w-3 h-3" />
            Вернуться к своему аккаунту
          </button>
        </div>
      )}

      {/* Header */}
      <header className={`fixed ${isImpersonating ? 'top-8' : 'top-0'} left-0 right-0 h-[60px] flex items-center justify-between px-8 z-[1000] transition-all`}
        style={{
          background: 'rgba(2, 12, 27, 0.8)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo and Nav Links */}
        <div className="flex items-center gap-8 select-none shrink-0 relative z-10">
          <span
            className="text-[24px] font-normal tracking-wide text-[#10B981] cursor-pointer"
            style={{ fontFamily: "'IM Fell Great Primer', serif" }}
            onClick={() => navigate(user?.role === 'admin' || user?.role === 'expert' ? '/editor' : '/map')}
          >
            freshmap
          </span>

          {/* Navigation links (Top-Left) */}
          <div className="flex items-center gap-1 border-l border-white/10 pl-6 ml-2">
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="p-2.5 text-slate-400 hover:text-[#10B981] transition-all rounded-full hover:bg-white/5 group"
                title="Дашборд"
              >
                <LayoutDashboard className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        </div>

        {/* Absolutely Centered Search Container */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-xl pointer-events-none flex justify-center">
            <div id="header-search-portal" className="pointer-events-auto w-full flex justify-center" />
        </div>

        {/* User Info & Settings (Right side) */}
        <div className="flex items-center gap-4 shrink-0 relative z-10">
          <div className="flex items-center gap-3 pr-2 border-r border-white/10">
            <span className="text-[11px] font-bold text-slate-400 tracking-wide opacity-80">{displayName}</span>
            
            {user?.role === 'admin' && (
              <div className="px-2 py-0.5 text-[7px] font-black bg-[#10B981]/10 text-[#10B981] rounded-md border border-[#10B981]/20 uppercase tracking-[0.2em]">
                ADM
              </div>
            )}
            {user?.role === 'expert' && (
              <div className="px-2 py-0.5 text-[7px] font-black bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20 uppercase tracking-[0.2em]">
                EXP
              </div>
            )}
          </div>

          {/* Settings at the very end */}
          <button
            onClick={() => navigate('/settings')}
            className="p-2.5 text-slate-400 hover:text-[#10B981] transition-all rounded-full hover:bg-white/5 group"
            title="Настройки"
          >
            <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="h-full overflow-hidden">
        {children}
      </main>
    </div>
  )
}
