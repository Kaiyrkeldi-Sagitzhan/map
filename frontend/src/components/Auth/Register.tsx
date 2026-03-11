import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Mail, Lock, ArrowRight } from 'lucide-react'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }

    setLoading(true)

    try {
      await register(email, password)
    } catch (err) {
      setError('Ошибка регистрации. Попробуйте снова')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="text-[32px] font-normal tracking-wide text-[#10B981]"
                style={{ fontFamily: "'IM Fell Great Primer', serif" }}>
            freshmap
          </span>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-[40px] p-10 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-normal text-[#10B981] mb-2"
                style={{ fontFamily: "'IM Fell Great Primer', serif" }}>
              Создать аккаунт
            </h1>
            <p className="text-slate-400 text-xs uppercase tracking-[0.2em]">join the ecosystem</p>
          </div>
          
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs text-center">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.2em] ml-4">
                Электронная почта
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-600" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="identity@freshmap.team"
                  className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/5 rounded-full text-white placeholder-slate-700 focus:outline-none focus:border-[#10B981] transition-all"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.2em] ml-4">
                Пароль
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-600" />
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/5 rounded-full text-white placeholder-slate-700 focus:outline-none focus:border-[#10B981] transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.2em] ml-4">
                Подтвердите пароль
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-600" />
                </div>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/5 rounded-full text-white placeholder-slate-700 focus:outline-none focus:border-[#10B981] transition-all"
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 px-4 bg-transparent border border-[#10B981] text-[#10B981] font-bold rounded-full transition-all duration-500 flex items-center justify-center gap-2 hover:bg-[#10B981] hover:text-[#020C1B] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
            >
              {loading ? (
                <span>Создание...</span>
              ) : (
                <>
                  <span>Создать аккаунт</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[11px] text-slate-500 uppercase tracking-widest">
              Уже есть аккаунт?{' '}
              <Link to="/" className="text-[#10B981] hover:underline font-bold">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
