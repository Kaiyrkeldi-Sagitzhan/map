import { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Map, LogOut, User } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAdmin, logout } = useAuth()

  return (
    <div className="h-screen overflow-hidden bg-slate-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-50">
        <div className="h-full px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              Geo<span className="text-emerald-400">KZ</span>
            </span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400">
              <User className="w-4 h-4" />
              <span className="text-sm">{user?.email}</span>
              {isAdmin && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                  Admin
                </span>
              )}
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 h-full overflow-hidden">
        {children}
      </main>
    </div>
  )
}
