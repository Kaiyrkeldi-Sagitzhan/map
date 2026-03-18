import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiService } from '../../services/api'
import { X, Mail, Lock, Loader2 } from 'lucide-react'

interface Props {
  mode: 'login' | 'register' | 'verify'
  onClose: () => void
  onSwitchMode: (mode: 'login' | 'register' | 'verify') => void
}

export default function AuthModal({ mode, onClose, onSwitchMode }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const { login, register } = useAuth()

  // Countdown timer for resend code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSendCode = async () => {
    if (!email) {
      setError('Введите email')
      return
    }
    setLoading(true)
    setError('')
    try {
      await apiService.sendVerificationCode(email)
      setCountdown(60)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка отправки кода')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyAndRegister = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Введите 6-значный код')
      return
    }
    setLoading(true)
    setError('')
    try {
      await apiService.verifyCode(email, verificationCode)
      await register(email, password)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка верификации')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        onClose()
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Пароли не совпадают')
          setLoading(false)
          return
        }
        // Start verification flow
        await handleSendCode()
        onSwitchMode('verify')
      }
    } catch {
      setError(mode === 'login' ? 'Неверная почта или пароль' : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const { url } = await apiService.getGoogleAuthURL()
      window.location.href = url
    } catch {
      setError('Ошибка при подключении Google')
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
      <div className="relative w-full max-w-md mx-4 rounded-[40px] border border-white/10 p-10 shadow-2xl overflow-hidden"
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
          {mode === 'login' ? 'Авторизация' : mode === 'register' ? 'Создать аккаунт' : 'Подтверждение почты'}
        </h2>
        <p className="text-slate-400 text-center mb-8 text-sm uppercase tracking-[0.2em]">
          {mode === 'login'
            ? 'topographic mapping system'
            : mode === 'register'
            ? 'join the ecosystem'
            : 'введите код из письма'}
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs tracking-wide text-center">
            {error}
          </div>
        )}

        {mode === 'verify' ? (
          // Verification code input
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.2em] ml-4">
                Код подтверждения
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                placeholder="000000"
                className="w-full px-4 py-3 bg-black/20 border border-white/5 rounded-full text-white text-center text-2xl tracking-[0.5em] placeholder-slate-700 focus:outline-none focus:border-[#10B981] transition-all"
              />
            </div>

            <button
              type="button"
              onClick={handleVerifyAndRegister}
              disabled={loading || verificationCode.length !== 6}
              className="w-full py-4 bg-transparent border border-[#10B981] text-[#10B981] font-bold rounded-full hover:bg-[#10B981] hover:text-[#020C1B] transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Подтвердить и зарегистрироваться'}
            </button>

            <div className="text-center">
              <button
                onClick={handleSendCode}
                disabled={countdown > 0}
                className="text-[10px] text-slate-500 uppercase tracking-widest hover:text-[#10B981] transition-colors disabled:opacity-50"
              >
                {countdown > 0 ? `Отправить повторно через ${countdown}с` : 'Отправить код повторно'}
              </button>
            </div>

            <div className="text-center text-[11px] text-slate-500 uppercase tracking-widest mt-4">
              <button
                onClick={() => onSwitchMode('register')}
                className="text-[#10B981] hover:underline font-bold"
              >
                Изменить email
              </button>
            </div>
          </div>
        ) : (
          // Login or Register form
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.2em] ml-4">
                Электронная почта
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-600" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="identity@freshmap.team"
                  className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/5 rounded-full text-white placeholder-slate-700 focus:outline-none focus:border-[#10B981] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.2em] ml-4">
                Пароль
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-600" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/5 rounded-full text-white placeholder-slate-700 focus:outline-none focus:border-[#10B981] transition-all"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.2em] ml-4">
                  Подтверждение пароля
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-600" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/5 rounded-full text-white placeholder-slate-700 focus:outline-none focus:border-[#10B981] transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-transparent border border-[#10B981] text-[#10B981] font-bold rounded-full hover:bg-[#10B981] hover:text-[#020C1B] transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
            >
              {loading
                ? (mode === 'login' ? 'Проверка...' : 'Отправка кода...')
                : (mode === 'login' ? 'Войти' : 'Регистрация')
              }
            </button>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] uppercase tracking-widest">или</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-white/5 border border-white/10 rounded-full text-white font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm">Продолжить с Google</span>
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-[11px] text-slate-500 uppercase tracking-widest">
          {mode === 'login' ? (
            <>
              Нет аккаунта?{' '}
              <button
                onClick={() => onSwitchMode('register')}
                className="text-[#10B981] hover:underline font-bold"
              >
                Регистрация
              </button>
            </>
          ) : mode === 'register' ? (
            <>
              Уже есть аккаунт?{' '}
              <button
                onClick={() => onSwitchMode('login')}
                className="text-[#10B981] hover:underline font-bold"
              >
                Войти
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
