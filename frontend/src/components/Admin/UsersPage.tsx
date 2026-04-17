import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, LogIn, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAdminStore } from '../../store/adminStore'
import { useAuth } from '../../context/AuthContext'
import { apiService } from '../../services/api'
import UserEditModal from './UserEditModal'
import type { User } from '../../types'

const UsersPage = () => {
  const { users, totalUsers, usersPage, usersSearch, usersLoading, fetchUsers, setUsersSearch, setUsersPage, deleteUser } = useAdminStore()
  const { setAuthData } = useAuth()
  const navigate = useNavigate()
  const [editUser, setEditUser] = useState<User | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(usersSearch)

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setUsersSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput, setUsersSearch])

  const totalPages = Math.ceil(totalUsers / 20)

  const handleImpersonate = async (user: User) => {
    try {
      // Save current admin session
      const currentToken = localStorage.getItem('token')
      const currentUser = localStorage.getItem('user')
      if (currentToken) sessionStorage.setItem('admin_token', currentToken)
      if (currentUser) sessionStorage.setItem('admin_user', currentUser)

      const resp = await apiService.impersonateUser(user.id)
      setAuthData(resp.token, resp.user)
      navigate(resp.user.role === 'admin' ? '/editor' : '/map')
    } catch (e) {
      console.error('Impersonation failed:', e)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id)
      setDeleteConfirm(null)
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white mb-1">Пользователи</h1>
          <p className="text-xs text-slate-500">{totalUsers} пользователей всего</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-[#0d9668] text-white transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Создать пользователя
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
            placeholder="Поиск по имени, фамилии, никнейму или email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {/* Users Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(10, 25, 47, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {usersLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500">Пользователи не найдены</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Пользователь</th>
                <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Email</th>
                <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Роль</th>
                <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Дата</th>
                <th className="text-right px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs text-white font-medium">
                        {u.nickname || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Нет имени'}
                      </p>
                      {u.nickname && (u.first_name || u.last_name) && (
                        <p className="text-[10px] text-slate-500">{`${u.first_name || ''} ${u.last_name || ''}`.trim()}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      u.role === 'admin'
                        ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'
                        : u.role === 'expert'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {u.role === 'admin' ? 'Администратор' : u.role === 'expert' ? 'Эксперт' : 'Пользователь'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">
                    {new Date(u.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditUser(u)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Редактировать"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleImpersonate(u)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#10B981] hover:bg-[#10B981]/10 transition-colors"
                        title="Войти как пользователь"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                      </button>
                      {deleteConfirm === u.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="px-2 py-1 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          >
                            Да
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 rounded text-[10px] text-slate-500 hover:bg-white/5 transition-colors"
                          >
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(u.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/5">
            <button
              onClick={() => setUsersPage(usersPage - 1)}
              disabled={usersPage <= 1}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-slate-400">
              {usersPage} / {totalPages}
            </span>
            <button
              onClick={() => setUsersPage(usersPage + 1)}
              disabled={usersPage >= totalPages}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {(editUser || isCreating) && (
        <UserEditModal
          user={editUser}
          onClose={() => { setEditUser(null); setIsCreating(false) }}
          onSaved={() => { setEditUser(null); setIsCreating(false); fetchUsers() }}
        />
      )}
    </div>
  )
}

export default UsersPage
