import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { X, Mail, Lock } from 'lucide-react'

interface Props {
  mode: 'login' | 'register'
  onClose: () => void
  onSwitchMode: (mode: 'login' | 'register') => void
}

export default function AuthModal({ mode, onClose, onSwitchMode }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      onClose()
    } catch {
      setError(mode === 'login' ? 'Неверная почта или пароль' : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-white/10 p-8 shadow-2xl"
        style={{ background: 'rgba(10, 25, 47, 0.95)', backdropFilter: 'blur(20px)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          {mode === 'login' ? 'Добро пожаловать' : 'Создать аккаунт'}
        </h2>
        <p className="text-slate-400 text-center mb-6">
          {mode === 'login'
            ? 'Войдите для доступа к редактору'
            : 'Зарегистрируйтесь для начала работы'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Электронная почта
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-4 h-4 text-slate-500" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/30 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Пароль
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-slate-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/30 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#FFD700] text-[#0A192F] font-semibold rounded-lg hover:bg-[#FFE44D] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? (mode === 'login' ? 'Вход...' : 'Создание...')
              : (mode === 'login' ? 'Войти' : 'Создать аккаунт')
            }
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-400">
          {mode === 'login' ? (
            <>
              Нет аккаунта?{' '}
              <button
                onClick={() => onSwitchMode('register')}
                className="text-[#FFD700] hover:text-[#FFE44D] font-medium"
              >
                Зарегистрироваться
              </button>
            </>
          ) : (
            <>
              Уже есть аккаунт?{' '}
              <button
                onClick={() => onSwitchMode('login')}
                className="text-[#FFD700] hover:text-[#FFE44D] font-medium"
              >
                Войти
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
