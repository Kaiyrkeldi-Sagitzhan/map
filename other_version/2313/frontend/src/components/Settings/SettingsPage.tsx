import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, LogOut, User, Lock, Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const SettingsPage = () => {
  const { user, logout, updateProfile } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleSaveProfile = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const data: any = {}
      if (firstName !== (user?.first_name || '')) data.first_name = firstName
      if (lastName !== (user?.last_name || '')) data.last_name = lastName
      if (nickname !== (user?.nickname || '')) data.nickname = nickname

      if (newPassword) {
        if (newPassword !== confirmPassword) {
          setError('Пароли не совпадают')
          setSaving(false)
          return
        }
        if (newPassword.length < 6) {
          setError('Пароль должен быть не менее 6 символов')
          setSaving(false)
          return
        }
        data.current_password = currentPassword
        data.new_password = newPassword
      }

      if (Object.keys(data).length === 0) {
        setSaving(false)
        return
      }

      await updateProfile(data)
      setSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка сохранения')
    }

    setSaving(false)
  }

  return (
    <div className="h-full overflow-auto pt-24 pb-10 px-4 flex justify-center">
      <div className="w-full max-w-lg">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад
        </button>

        {/* Profile Section */}
        <div
          className="rounded-2xl p-6 mb-4"
          style={{
            background: 'rgba(10, 25, 47, 0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-[#10B981]" />
            <h2 className="text-sm font-semibold text-white">Профиль</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Email</label>
              <div className="w-full bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-500">
                {user?.email}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Роль</label>
              <div className="w-full bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-500 capitalize">
                {user?.role === 'admin' ? 'Администратор' : 'Пользователь'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Имя</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
                  placeholder="Введите имя"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Фамилия</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
                  placeholder="Введите фамилию"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Никнейм</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
                placeholder="Введите никнейм"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Password Section */}
        <div
          className="rounded-2xl p-6 mb-4"
          style={{
            background: 'rgba(10, 25, 47, 0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-4 h-4 text-[#10B981]" />
            <h2 className="text-sm font-semibold text-white">Изменить пароль</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Текущий пароль</label>
              <input
                type="password"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
                placeholder="Введите текущий пароль"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Новый пароль</label>
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
                  placeholder="Минимум 6 символов"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Подтвердить</label>
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]/50 transition-colors"
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error / Success */}
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        {saved && (
          <div className="flex items-center gap-2 text-xs text-[#10B981] mb-3">
            <Check className="w-3.5 h-3.5" /> Сохранено
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-[#0d9668] text-white transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-red-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
