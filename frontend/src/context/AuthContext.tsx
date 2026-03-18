import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../services/api'
import type { User, AuthContextType, UpdateProfileRequest } from '../types'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [isExpert, setIsExpert] = useState<boolean>(false)
  const [canEdit, setCanEdit] = useState<boolean>(false)
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser)
      setUser(parsedUser)
      setIsAdmin(parsedUser.role === 'admin')
      setIsExpert(parsedUser.role === 'expert')
      setCanEdit(parsedUser.role === 'admin' || parsedUser.role === 'expert')
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
    setIsExpert(response.user.role === 'expert')
    setCanEdit(response.user.role === 'admin' || response.user.role === 'expert')
    setIsAuthenticated(true)
    // Role-based redirect
    if (response.user.role === 'admin' || response.user.role === 'expert') {
      navigate('/editor')
    } else {
      navigate('/map')
    }
  }

  const register = async (email: string, password: string, role?: string) => {
    const response = await apiService.register({ email, password, role })
    localStorage.setItem('token', response.token)
    localStorage.setItem('user', JSON.stringify(response.user))
    setToken(response.token)
    setUser(response.user)
    setIsAdmin(response.user.role === 'admin')
    setIsExpert(response.user.role === 'expert')
    setCanEdit(response.user.role === 'admin' || response.user.role === 'expert')
    setIsAuthenticated(true)
    // Role-based redirect
    if (response.user.role === 'admin' || response.user.role === 'expert') {
      navigate('/editor')
    } else {
      navigate('/map')
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // Also clear any impersonation data
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_user')
    setToken(null)
    setUser(null)
    setIsAdmin(false)
    setIsExpert(false)
    setCanEdit(false)
    setIsAuthenticated(false)
    navigate('/')
  }

  const updateProfile = async (data: UpdateProfileRequest) => {
    const updatedUser = await apiService.updateProfile(data)
    const merged = { ...user, ...updatedUser } as User
    setUser(merged)
    localStorage.setItem('user', JSON.stringify(merged))
  }

  const updateUser = (newUser: User) => {
    setUser(newUser)
    setIsAdmin(newUser.role === 'admin')
    setIsExpert(newUser.role === 'expert')
    setCanEdit(newUser.role === 'admin' || newUser.role === 'expert')
    localStorage.setItem('user', JSON.stringify(newUser))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        isExpert,
        canEdit,
        login,
        register,
        logout,
        updateProfile,
        updateUser,
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
