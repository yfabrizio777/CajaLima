import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { AuthLayout } from '../../../components/layout/AuthLayout'
import { setupAvailable } from '../api'
import { useAuth } from '../AuthContext'
import { AuthForm } from '../components/AuthForm'

export function SetupPage() {
  const { user } = useAuth()
  const [state, setState] = useState<'loading' | 'open' | 'closed' | 'error'>(
    'loading',
  )
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setupAvailable(controller.signal)
      .then((available) => {
        if (!controller.signal.aborted) setState(available ? 'open' : 'closed')
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [retry])
  if (user) return <Navigate to="/app" replace />
  if (state === 'closed')
    return (
      <Navigate
        to="/login"
        replace
        state={{
          notice: 'CajaLima ya está configurada. Ingresa con tu cuenta.',
        }}
      />
    )
  return (
    <AuthLayout>
      {state === 'open' ? (
        <AuthForm setup />
      ) : (
        <div className="connection-state">
          <h1>
            {state === 'error'
              ? 'No pudimos conectar.'
              : 'Preparando tu CajaLima…'}
          </h1>
          <output>
            {state === 'error'
              ? 'Revisa tu conexión e inténtalo de nuevo.'
              : 'Estamos comprobando si tu negocio ya está configurado.'}
          </output>
          {state === 'error' && (
            <button
              className="button button-primary"
              onClick={() => {
                setState('loading')
                setRetry(retry + 1)
              }}
            >
              Volver a intentar
            </button>
          )}
        </div>
      )}
    </AuthLayout>
  )
}
