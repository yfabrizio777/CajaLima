import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Icon } from './Icon'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  id: string
}
export function Field({ label, error, hint, id, type, ...props }: Props) {
  const [visible, setVisible] = useState(false)
  const password = type === 'password'
  const description =
    [hint ? `${id}-hint` : '', error ? `${id}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          {...props}
          id={id}
          type={password && visible ? 'text' : type}
          className={password ? 'input input-password' : 'input'}
          aria-invalid={error ? true : undefined}
          aria-describedby={description}
        />
        {password && (
          <button
            type="button"
            className="password-toggle"
            aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            <Icon name="eye" />
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}
