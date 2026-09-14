export interface FormValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}
export type FormErrors = Partial<Record<keyof FormValues, string>>

export function validate(values: FormValues, setup: boolean): FormErrors {
  const errors: FormErrors = {}
  if (setup && (!values.name.trim() || values.name.trim().length > 120))
    errors.name = 'Escribe tu nombre (máximo 120 caracteres).'
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ||
    values.email.trim().length > 180
  )
    errors.email = 'Escribe un correo válido, como nombre@ejemplo.com.'
  if (!values.password || (setup && values.password.length < 8))
    errors.password = setup
      ? 'Usa al menos 8 caracteres.'
      : 'Escribe tu contraseña.'
  if (new TextEncoder().encode(values.password).length > 72)
    errors.password = 'Usa una contraseña más corta (máximo 72 bytes).'
  if (setup && values.confirmPassword !== values.password)
    errors.confirmPassword = 'Las contraseñas no coinciden.'
  return errors
}
