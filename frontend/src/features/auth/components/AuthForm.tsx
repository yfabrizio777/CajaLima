import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Field } from '../../../components/ui/Field'
import { Icon } from '../../../components/ui/Icon'
import { KusiNote } from '../../../components/ui/KusiNote'
import { ApiError } from '../../../lib/http'
import { registerOwner } from '../api'
import { useAuth } from '../AuthContext'
import { validate } from '../validation'
import type { FormErrors, FormValues } from '../validation'

export function AuthForm({
  setup = false,
  showSetup = false,
}: {
  setup?: boolean
  showSetup?: boolean
}) {
  const [values, setValues] = useState<FormValues>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const notice =
    location.state &&
    typeof location.state === 'object' &&
    'notice' in location.state &&
    typeof location.state.notice === 'string'
      ? location.state.notice
      : ''

  useEffect(() => () => controller.current?.abort(), [])
  const update = (key: keyof FormValues, value: string) => {
    setValues({ ...values, [key]: value })
    setErrors({ ...errors, [key]: undefined })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const invalid = validate(values, setup)
    setErrors(invalid)
    setMessage('')
    if (Object.keys(invalid).length) {
      const first = Object.keys(invalid)[0]
      document.getElementById(first || '')?.focus()
      return
    }
    setPending(true)
    controller.current = new AbortController()
    const signal = controller.current.signal
    const credentials = {
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }
    try {
      if (setup) {
        await registerOwner(
          { ...credentials, name: values.name.trim() },
          signal,
        )
        if (!signal.aborted)
          navigate('/login', {
            replace: true,
            state: { notice: 'Tu cuenta está lista. Ya puedes ingresar.' },
          })
      } else {
        await signIn(credentials, signal)
        if (!signal.aborted) navigate('/app', { replace: true })
      }
    } catch (error) {
      if (signal.aborted) return
      if (setup && error instanceof ApiError && error.status === 403) {
        navigate('/login', {
          replace: true,
          state: {
            notice: 'CajaLima ya está configurada. Ingresa con tu cuenta.',
          },
        })
        return
      }
      setMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos completar la solicitud.',
      )
      window.requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      if (!signal.aborted) setPending(false)
    }
  }

  return (
    <div className="auth-form-content">
      <span className="eyebrow">
        {setup ? 'EMPECEMOS POR TU CUENTA' : 'BIENVENIDO A TU NEGOCIO'}
      </span>
      <h1>{setup ? 'Configuremos CajaLima' : 'Qué bueno verte.'}</h1>
      <p className="form-intro">
        {setup
          ? 'Primero necesitamos crear la cuenta de la persona que administrará el negocio.'
          : 'Ingresa a tu espacio. Tu negocio, más claro.'}
      </p>
      {notice && (
        <output className="notice">
          <Icon name="check" />
          <span>{notice}</span>
        </output>
      )}
      {message && (
        <div ref={errorRef} className="form-alert" role="alert" tabIndex={-1}>
          <Icon name="info" />
          <span>{message}</span>
        </div>
      )}
      <form onSubmit={submit} noValidate aria-busy={pending}>
        {setup && (
          <Field
            id="name"
            label="Nombre"
            autoComplete="name"
            required
            maxLength={120}
            value={values.name}
            error={errors.name}
            onChange={(e) => update('name', e.target.value)}
          />
        )}
        <Field
          id="email"
          label="Correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          maxLength={180}
          placeholder="nombre@ejemplo.com"
          value={values.email}
          error={errors.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <Field
          id="password"
          label="Contraseña"
          type="password"
          autoComplete={setup ? 'new-password' : 'current-password'}
          required
          maxLength={72}
          value={values.password}
          error={errors.password}
          hint={
            setup
              ? 'Al menos 8 caracteres. Combina palabras, números y símbolos.'
              : undefined
          }
          onChange={(e) => update('password', e.target.value)}
        />
        {setup && (
          <Field
            id="confirmPassword"
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            required
            maxLength={72}
            value={values.confirmPassword}
            error={errors.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
          />
        )}
        <button
          className="button button-primary submit-button"
          type="submit"
          disabled={pending}
        >
          {pending ? 'Un momento…' : setup ? 'Crear mi cuenta' : 'Ingresar'}
          <Icon name="arrow" />
        </button>
      </form>
      {(setup || showSetup) && (
        <p className="form-switch">
          {setup ? '¿Ya tienes una cuenta?' : '¿Es tu primera vez por aquí?'}{' '}
          <Link to={setup ? '/login' : '/setup'}>
            {setup ? 'Inicia sesión' : 'Configurar CajaLima'}
          </Link>
        </p>
      )}
      <KusiNote>
        {setup
          ? 'Un gran negocio empieza con un primer paso. Vamos juntos.'
          : 'Vamos a ver cómo va tu negocio.'}
      </KusiNote>
      <p className="auth-security">
        <Icon name="lock" />
        Por seguridad, deberás iniciar sesión nuevamente al recargar la página.
      </p>
    </div>
  )
}
