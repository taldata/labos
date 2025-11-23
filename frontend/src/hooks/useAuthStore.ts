import { create } from 'zustand'
import { User } from '@/types'
import api from '@/services/api'

interface AuthState {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  login: async (username, password) => {
    try {
      const response = await api.login(username, password)
      if (response.data.success && response.data.data) {
        set({ user: response.data.data.user })
      } else {
        throw new Error(response.data.message || 'Login failed')
      }
    } catch (error) {
      throw error
    }
  },

  logout: async () => {
    try {
      await api.logout()
      set({ user: null })
    } catch (error) {
      // Even if API call fails, clear local state
      set({ user: null })
    }
  },

  loadUser: async () => {
    try {
      set({ isLoading: true })
      const response = await api.getCurrentUser()
      if (response.data.success && response.data.data) {
        set({ user: response.data.data, isLoading: false })
      } else {
        set({ user: null, isLoading: false })
      }
    } catch (error) {
      set({ user: null, isLoading: false })
    }
  },
}))

// Load user on app init
useAuthStore.getState().loadUser()
