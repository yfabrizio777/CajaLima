import { createContext, useContext } from 'react'
import type { Credentials, User } from './types'
import type { RequestOptions } from '../../lib/http'

interface AuthState {
  user: User | null
  signIn: (credentials: Credentials, signal?: AbortSignal) => Promise<void>
  signOut: () => void
  authenticatedRequest: (
    path: string,
    options?: Omit<RequestOptions, 'token'>,
  ) => Promise<unknown>
}
export const AuthContext = createContext<AuthState | null>(null)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider no está disponible.')
  return context
}
