export interface User {
  id: number
  name: string
  email: string
  role: 'ADMIN' | 'EMPLOYEE'
  active: boolean
}

export interface Credentials {
  email: string
  password: string
}
export interface SetupRequest extends Credentials {
  name: string
}
export interface LoginResponse {
  token: string
  type: 'Bearer'
  expiresIn: number
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseUser(value: unknown): User {
  if (
    !object(value) ||
    typeof value.id !== 'number' ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0 ||
    typeof value.name !== 'string' ||
    typeof value.email !== 'string' ||
    (value.role !== 'ADMIN' && value.role !== 'EMPLOYEE') ||
    value.active !== true
  ) {
    throw new Error('No pudimos verificar tu cuenta. Vuelve a ingresar.')
  }
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
    active: value.active,
  }
}

export function parseLogin(value: unknown): LoginResponse {
  if (
    !object(value) ||
    typeof value.token !== 'string' ||
    value.token.length > 4096 ||
    !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(value.token) ||
    value.type !== 'Bearer' ||
    typeof value.expiresIn !== 'number' ||
    !Number.isInteger(value.expiresIn) ||
    value.expiresIn <= 0 ||
    value.expiresIn > 86400
  ) {
    throw new Error('No pudimos iniciar tu sesión. Inténtalo de nuevo.')
  }
  return { token: value.token, type: value.type, expiresIn: value.expiresIn }
}

export function parseSetup(value: unknown): boolean {
  if (!object(value) || typeof value.available !== 'boolean') {
    throw new Error('No pudimos comprobar la configuración del negocio.')
  }
  return value.available
}
