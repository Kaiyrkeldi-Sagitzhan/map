import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { useAdminStore } from '../../store/adminStore'
import type { User } from '../../types'

interface UserEditModalProps {
  user: User | null // null = create mode
  onClose: () => void
  onSaved: () => void
}

const UserEditModal = ({ user, onClose, onSaved }: UserEditModalProps) => {
  const isCreate = !user
  const { createUser, updateUser } = useAdminStore()

  const [email, setEmail] = useState(user?.email || '')
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [role, setRole] = useState<string>(user?.role || 'user')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (isCreate && (!email || !password)) {
      setError('Email и пароль обязательны')
      return
    }
    setSaving(true)

    try {
      if (isCreate) {
        await createUser({ email, password, role, first_name: firstName, last_name: lastName, nickname })
      } else {
        const data: any = {}
        if (email !== user.email) data.email = email
        if (role !== user.role) data.role = role
        if (firstName !== (user.first_name || '')) data.first_name = firstName
        if (lastName !== (user.last_name || '')) data.last_name = lastName
        if (nickname !== (user.nickname || '')) data.nickname = nickname
        if (password) data.password = password
        await updateUser(user.id, data)
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка сохранения')
    }

    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10, 25, 47, 0.95)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">
            {isCreate ? 'Создать пользователя' : 'Редактировать пользователя'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Email *</label>
            <input
              type="email"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Имя</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Имя"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Фамилия</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Фамилия"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Никнейм</label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Никнейм"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Роль *</label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#10B981]/50 transition-colors appearance-none"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="user" className="bg-[#0A192F]">Пользователь</option>
              <option value="expert" className="bg-[#0A192F]">Эксперт</option>
              <option value="admin" className="bg-[#0A192F]">Администратор</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
              {isCreate ? 'Пароль *' : 'Новый пароль'} <span className="text-slate-600">{!isCreate && '(оставьте пустым)'}</span>
            </label>
            <input
              type="password"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isCreate ? 'Минимум 6 символов' : 'Оставьте пустым если не менять'}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-[#0d9668] text-white transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserEditModal
