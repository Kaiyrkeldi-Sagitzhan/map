import { create } from 'zustand'
import { apiService } from '../services/api'
import type { User, Complaint, StatsResponse } from '../types'

interface AdminState {
  // Users
  users: User[]
  totalUsers: number
  usersPage: number
  usersSearch: string
  usersLoading: boolean

  // Complaints
  complaints: Complaint[]
  totalComplaints: number
  complaintsPage: number
  complaintsStatus: string
  complaintsLoading: boolean
  pendingCount: number

  // Stats
  stats: StatsResponse | null
  statsLoading: boolean

  // Actions - Users
  fetchUsers: (search?: string, page?: number) => Promise<void>
  setUsersSearch: (s: string) => void
  setUsersPage: (p: number) => void
  createUser: (data: any) => Promise<void>
  updateUser: (id: string, data: any) => Promise<void>
  deleteUser: (id: string) => Promise<void>

  // Actions - Complaints
  fetchComplaints: (status?: string, page?: number) => Promise<void>
  setComplaintsStatus: (s: string) => void
  setComplaintsPage: (p: number) => void
  updateComplaint: (id: string, data: any) => Promise<void>
  fetchPendingCount: () => Promise<void>

  // Actions - Stats
  fetchStats: () => Promise<void>
}

export const useAdminStore = create<AdminState>((set, get) => ({
  users: [],
  totalUsers: 0,
  usersPage: 1,
  usersSearch: '',
  usersLoading: false,

  complaints: [],
  totalComplaints: 0,
  complaintsPage: 1,
  complaintsStatus: '',
  complaintsLoading: false,
  pendingCount: 0,

  stats: null,
  statsLoading: false,

  // Users
  fetchUsers: async (search?: string, page?: number) => {
    const s = search ?? get().usersSearch
    const p = page ?? get().usersPage
    set({ usersLoading: true })
    try {
      const resp = await apiService.listUsers(s || undefined, p, 20)
      set({ users: resp.users || [], totalUsers: resp.total, usersPage: p, usersSearch: s })
    } catch (e) {
      console.error('Failed to fetch users:', e)
    }
    set({ usersLoading: false })
  },

  setUsersSearch: (s: string) => {
    set({ usersSearch: s, usersPage: 1 })
    get().fetchUsers(s, 1)
  },

  setUsersPage: (p: number) => {
    set({ usersPage: p })
    get().fetchUsers(undefined, p)
  },

  createUser: async (data: any) => {
    await apiService.createUser(data)
    get().fetchUsers()
  },

  updateUser: async (id: string, data: any) => {
    await apiService.updateUser(id, data)
    get().fetchUsers()
  },

  deleteUser: async (id: string) => {
    await apiService.deleteUser(id)
    get().fetchUsers()
  },

  // Complaints
  fetchComplaints: async (status?: string, page?: number) => {
    const s = status ?? get().complaintsStatus
    const p = page ?? get().complaintsPage
    set({ complaintsLoading: true })
    try {
      const resp = await apiService.listComplaints(s || undefined, p, 20)
      set({ complaints: resp.complaints || [], totalComplaints: resp.total, complaintsPage: p, complaintsStatus: s })
    } catch (e) {
      console.error('Failed to fetch complaints:', e)
    }
    set({ complaintsLoading: false })
  },

  setComplaintsStatus: (s: string) => {
    set({ complaintsStatus: s, complaintsPage: 1 })
    get().fetchComplaints(s, 1)
  },

  setComplaintsPage: (p: number) => {
    set({ complaintsPage: p })
    get().fetchComplaints(undefined, p)
  },

  updateComplaint: async (id: string, data: any) => {
    await apiService.updateComplaint(id, data)
    get().fetchComplaints()
    get().fetchPendingCount()
  },

  fetchPendingCount: async () => {
    try {
      const resp = await apiService.listComplaints('pending', 1, 1)
      set({ pendingCount: resp.total })
    } catch { /* ignore */ }
  },

  // Stats
  fetchStats: async () => {
    set({ statsLoading: true })
    try {
      const resp = await apiService.getStats()
      set({ stats: resp })
    } catch (e) {
      console.error('Failed to fetch stats:', e)
    }
    set({ statsLoading: false })
  },
}))
