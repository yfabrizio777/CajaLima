import { Navigate } from 'react-router'
import { useEffect, useState } from 'react'
import { setupAvailable } from '../api'
import { AuthLayout } from '../../../components/layout/AuthLayout'
import { useAuth } from '../AuthContext'
import { AuthForm } from '../components/AuthForm'

export function LoginPage() {
  const { user } = useAuth()
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setupAvailable(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setAvailable(value)
      })
      .catch(() => {
        /* Login remains available if setup cannot be checked. */
      })
    return () => controller.abort()
  }, [])
  return user ? (
    <Navigate to="/app" replace />
  ) : (
    <AuthLayout>
      <AuthForm showSetup={available} />
    </AuthLayout>
  )
}
