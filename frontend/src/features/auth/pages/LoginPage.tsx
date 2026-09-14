import { Navigate } from 'react-router'
import { AuthLayout } from '../../../components/layout/AuthLayout'
import { useAuth } from '../AuthContext'
import { AuthForm } from '../components/AuthForm'

export function LoginPage() {
  const { user } = useAuth()
  return user ? (
    <Navigate to="/app" replace />
  ) : (
    <AuthLayout>
      <AuthForm />
    </AuthLayout>
  )
}
