import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { LoginResponse } from './api'

export type AuthUser = Pick<LoginResponse, 'email' | 'username'>

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  setSession: (user: AuthUser) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setSession: (user) => set({ user, isAuthenticated: true }),
      clear: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'approx-auth' },
  ),
)
