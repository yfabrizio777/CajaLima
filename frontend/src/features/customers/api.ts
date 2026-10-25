import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../lib/http'
import type { RequestOptions } from '../../lib/http'
import { parseCustomer, parseCustomers } from './types'
import type { CustomerInput } from './types'
export function useCustomersApi() {
  const { authenticatedRequest } = useAuth()
  return useMemo(() => {
    async function call(path: string, options?: Omit<RequestOptions, 'token'>) {
      try {
        return await authenticatedRequest(`/customers${path}`, options)
      } catch (error) {
        if (error instanceof ApiError && error.status === 409)
          throw new ApiError(
            409,
            'Ese documento ya está registrado. Busca al cliente, incluso si está inactivo.',
          )
        if (error instanceof ApiError && error.status === 404)
          throw new ApiError(404, 'No encontramos este cliente.')
        throw error
      }
    }
    return {
      list: async (search: string, page: number, signal?: AbortSignal) =>
        parseCustomers(
          await call(
            '?' +
              new URLSearchParams({ search, page: String(page), size: '20' }),
            { signal },
          ),
        ),
      detail: async (id: number, signal?: AbortSignal) =>
        parseCustomer(await call(`/${id}`, { signal })),
      save: async (id: number | undefined, body: CustomerInput) =>
        parseCustomer(
          await call(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body }),
        ),
      status: async (id: number, active: boolean) =>
        parseCustomer(
          await call(`/${id}/status`, { method: 'PATCH', body: { active } }),
        ),
    }
  }, [authenticatedRequest])
}
