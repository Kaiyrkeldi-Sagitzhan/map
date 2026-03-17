import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, MessageSquareWarning, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAdminStore } from '../../store/adminStore'
import AdminRoutes from './AdminRoutes'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Дашборд', end: true },
  { to: '/admin/users', icon: Users, label: 'Пользователи', end: false },
  { to: '/admin/complaints', icon: MessageSquareWarning, label: 'Жалобы', end: false },
]

const AdminLayout = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const pendingCount = useAdminStore((s) => s.pendingCount)
  const fetchPendingCount = useAdminStore((s) => s.fetchPendingCount)

  // Poll pending complaints count
  useEffect(() => {
    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 30000)
    return () => clearInterval(interval)
  }, [fetchPendingCount])

  return (
    <div className="h-screen flex overflow-hidden bg-[#020C1B] text-white">
      {/* Sidebar */}
      <aside
        className="w-[240px] shrink-0 flex flex-col border-r border-white/5"
        style={{
          background: 'rgba(10, 25, 47, 0.7)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/5">
          <span
            className="text-[22px] font-normal tracking-wide text-[#10B981]"
            style={{ fontFamily: "'IM Fell Great Primer', serif" }}
          >
            freshmap
          </span>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Панель администратора</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.label === 'Жалобы' && pendingCount > 0 && (
                <span className="ml-auto text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info & back */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <div className="text-[11px] text-slate-500 truncate">
            {user?.nickname || user?.first_name || user?.email}
          </div>
          <button
            onClick={() => navigate('/editor')}
            className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-[#10B981] transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Вернуться к редактору
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <AdminRoutes />
      </main>
    </div>
  )
}

export default AdminLayout
