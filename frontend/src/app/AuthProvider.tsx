import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from '../features/auth/AuthContext'
import { currentUser, login } from '../features/auth/api'
import type { Credentials, User } from '../features/auth/types'
import { ApiError, request } from '../lib/http'
import type { RequestOptions } from '../lib/http'

interface Session {
  user: User
  expiresAt: number
  token: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const attempt = useRef(0)
  const signOut = useCallback(() => {
    attempt.current++
    setSession(null)
  }, [])

  const signIn = useCallback(
    async (credentials: Credentials, signal?: AbortSignal) => {
      const currentAttempt = ++attempt.current
      const result = await login(credentials, signal)
      const expiresAt = Date.now() + result.expiresIn * 1000
      const user = await currentUser(result.token, signal)
      if (signal?.aborted || currentAttempt !== attempt.current) return
      setSession({ user, expiresAt, token: result.token })
    },
    [],
  )

  useEffect(() => {
    if (!session) return
    const expire = () => {
      if (Date.now() >= session.expiresAt) signOut()
    }
    const timer = window.setTimeout(
      signOut,
      Math.max(0, session.expiresAt - Date.now()),
    )
    window.addEventListener('focus', expire)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', expire)
    }
  }, [session, signOut])

  const authenticatedRequest = useCallback(
    async (path: string, options: Omit<RequestOptions, 'token'> = {}) => {
      if (!session || Date.now() >= session.expiresAt) {
        signOut()
        throw new ApiError(401, 'Ingresa nuevamente para continuar.')
      }
      try {
        return await request(path, { ...options, token: session.token })
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) signOut()
        throw error
      }
    },
    [session, signOut],
  )

  // The token never leaves this in-memory provider. Full reload intentionally ends the session.
  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        signIn,
        signOut,
        authenticatedRequest,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
