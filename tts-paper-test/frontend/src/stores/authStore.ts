import { create } from "zustand"
import { persist } from "zustand/middleware"

interface User {
  id: number
  username: string
  email: string
  display_name?: string
  is_superuser: boolean
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (user, accessToken, refreshToken) => {
        localStorage.setItem("access_token", accessToken)
        localStorage.setItem("refresh_token", refreshToken)
        set({ user, accessToken, refreshToken, isAuthenticated: true })
      },
      logout: () => {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
      setUser: (user) => set({ user }),
    }),
    {
      name: "tss-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
