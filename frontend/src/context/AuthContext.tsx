import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../services/api'
import type { User, AuthContextType, UpdateProfileRequest } from '../types'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('token'))
  const [isAdmin, setIsAdmin] = useState<boolean>(() => getStoredUser()?.role === 'admin')
  const [isExpert, setIsExpert] = useState<boolean>(() => getStoredUser()?.role === 'expert')
  const [canEdit, setCanEdit] = useState<boolean>(() => {
    const storedUser = getStoredUser()
    return storedUser?.role === 'admin' || storedUser?.role === 'expert'
  })
  const navigate = useNavigate()

  useEffect(() => {
    const parsedUser = getStoredUser()
    if (parsedUser && token) {
      setUser(parsedUser)
      setIsAdmin(parsedUser.role === 'admin')
      setIsExpert(parsedUser.role === 'expert')
      setCanEdit(parsedUser.role === 'admin' || parsedUser.role === 'expert')
      setIsAuthenticated(true)
    } else {
      setUser(null)
      setIsAdmin(false)
      setIsExpert(false)
      setCanEdit(false)
      setIsAuthenticated(false)
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

  const setAuthData = (token: string, user: User) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setToken(token)
    setUser(user)
    setIsAdmin(user.role === 'admin')
    setIsExpert(user.role === 'expert')
    setCanEdit(user.role === 'admin' || user.role === 'expert')
    setIsAuthenticated(true)
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
        setAuthData,
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
