import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../services/api'
import type { User, AuthContextType } from '../types'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is logged in on mount
    const storedUser = localStorage.getItem('user')
    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser)
      setUser(parsedUser)
      setIsAdmin(parsedUser.role === 'admin')
      setIsAuthenticated(true)
    }
  }, [token])

  const login = async (email: string, password: string) => {
    const response = await apiService.login({ email, password })
    localStorage.setItem('token', response.token)
    localStorage.setItem('user', JSON.stringify(response.user))
    setToken(response.token)
    setUser(response.user)
    setIsAdmin(response.user.role === 'admin')
    setIsAuthenticated(true)
    navigate('/')
  }

  const register = async (email: string, password: string, role?: string) => {
    const response = await apiService.register({ email, password, role })
    localStorage.setItem('token', response.token)
    localStorage.setItem('user', JSON.stringify(response.user))
    setToken(response.token)
    setUser(response.user)
    setIsAdmin(response.user.role === 'admin')
    setIsAuthenticated(true)
    navigate('/')
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    setIsAdmin(false)
    setIsAuthenticated(false)
    navigate('/login')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
