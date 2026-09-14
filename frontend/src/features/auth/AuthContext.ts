import { createContext, useContext } from 'react'
import type { Credentials, User } from './types'

interface AuthState {
  user: User | null
  signIn: (credentials: Credentials, signal?: AbortSignal) => Promise<void>
  signOut: () => void
}
export const AuthContext = createContext<AuthState | null>(null)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider no está disponible.')
  return context
}
