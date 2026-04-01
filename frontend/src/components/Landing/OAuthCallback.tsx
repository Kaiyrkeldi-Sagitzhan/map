import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiService } from '../../services/api'
import { Loader2 } from 'lucide-react'

export default function OAuthCallback() {
  const navigate = useNavigate()
  const { setAuthData } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')

      if (!code) {
        setError('Missing authorization code')
        return
      }

      try {
        console.log('Starting OAuth callback')
        const redirectUri = `${window.location.origin}/auth/google/callback`
        console.log('Calling API with code:', code, 'redirectUri:', redirectUri)
        const response = await apiService.handleGoogleCallback(code, redirectUri)
        console.log('API response:', response)
        setAuthData(response.token, response.user)
        console.log('Auth data set, navigating')
        // Role-based redirect
        const role = response.user.role
        if (role === 'admin' || role === 'expert') {
          window.location.href = '/editor'
        } else {
          window.location.href = '/map'
        }
      } catch (err) {
        console.error('OAuth callback error:', err)
        setError('Failed to complete Google authentication')
      }
    }

    handleCallback()
  }, [navigate, setAuthData])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020C1B]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="text-[#10B981] hover:underline"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020C1B]">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#10B981] animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Выполняется вход...</p>
      </div>
    </div>
  )
}
