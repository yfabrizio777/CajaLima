import { request } from '../../lib/http'
import { parseLogin, parseSetup, parseUser } from './types'
import type { Credentials, SetupRequest } from './types'

export async function setupAvailable(signal?: AbortSignal) {
  return parseSetup(await request('/auth/setup', { signal }))
}
export async function registerOwner(body: SetupRequest, signal?: AbortSignal) {
  return parseUser(
    await request('/auth/register', { method: 'POST', body, signal }),
  )
}
export async function login(body: Credentials, signal?: AbortSignal) {
  return parseLogin(
    await request('/auth/login', { method: 'POST', body, signal }),
  )
}
export async function currentUser(token: string, signal?: AbortSignal) {
  return parseUser(await request('/auth/me', { token, signal }))
}
