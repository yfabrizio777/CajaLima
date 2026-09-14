export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const configuredUrl = (import.meta.env.VITE_API_URL || '/api').replace(
  /\/$/,
  '',
)
const apiUrl = new URL(configuredUrl, window.location.origin)
if (
  !['http:', 'https:'].includes(apiUrl.protocol) ||
  apiUrl.username ||
  apiUrl.password ||
  apiUrl.search ||
  apiUrl.hash
) {
  throw new Error('Revisa la configuración pública de la API.')
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  body?: unknown
  token?: string
  signal?: AbortSignal
}

export async function request(
  path: string,
  options: RequestOptions = {},
): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const timeout = AbortSignal.timeout(15000)
  let response: Response
  try {
    response = await fetch(`${apiUrl.href.replace(/\/$/, '')}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(
      0,
      'No pudimos conectar con CajaLima. Revisa tu conexión e inténtalo de nuevo.',
    )
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Revisa los datos del formulario.',
      401: 'Correo o contraseña incorrectos. Revisa tus datos.',
      403: 'No puedes realizar esta operación con tu cuenta.',
      409: 'Este correo ya está registrado. Prueba iniciar sesión.',
      429: 'Espera un momento antes de volver a intentarlo.',
    }
    throw new ApiError(
      response.status,
      messages[response.status] ||
        'No pudimos completar la solicitud. Inténtalo nuevamente.',
    )
  }
  try {
    return (await response.json()) as unknown
  } catch {
    throw new ApiError(
      0,
      'Recibimos una respuesta inesperada. Inténtalo nuevamente.',
    )
  }
}
