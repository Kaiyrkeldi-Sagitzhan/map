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
      <div className="relative w-full max-w-md mx-4 rounded-sm border border-white/10 p-10 shadow-2xl overflow-hidden"
        style={{ 
          background: 'rgba(2, 12, 27, 0.75)', 
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05)'
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-[#10B981] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-3xl font-normal text-[#10B981] mb-2 text-center"
            style={{ fontFamily: "'IM Fell Great Primer', serif" }}>
          {mode === 'login' ? 'freshmap access' : 'create account'}
        </h2>
        <p className="text-slate-400 text-center mb-8 text-sm uppercase tracking-[0.2em]">
          {mode === 'login'
            ? 'topographic mapping system'
            : 'join the ecosystem'}
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-sm text-red-400 text-xs tracking-wide text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.2em]">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-4 h-4 text-slate-600" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="identity@freshmap.team"
                className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/5 rounded-sm text-white placeholder-slate-700 focus:outline-none focus:border-[#10B981] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.2em]">
              Security Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-slate-600" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/5 rounded-sm text-white placeholder-slate-700 focus:outline-none focus:border-[#10B981] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-transparent border border-[#10B981] text-[#10B981] font-medium rounded-sm hover:bg-[#10B981] hover:text-[#020C1B] transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
          >
            {loading
              ? (mode === 'login' ? 'Verifying...' : 'Processing...')
              : (mode === 'login' ? 'Authorize' : 'Register')
            }
          </button>
        </form>

        <div className="mt-8 text-center text-[11px] text-slate-500 uppercase tracking-widest">
          {mode === 'login' ? (
            <>
              No credentials?{' '}
              <button
                onClick={() => onSwitchMode('register')}
                className="text-[#10B981] hover:underline"
              >
                Create Account
              </button>
            </>
          ) : (
            <>
              Already recognized?{' '}
              <button
                onClick={() => onSwitchMode('login')}
                className="text-[#10B981] hover:underline"
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
