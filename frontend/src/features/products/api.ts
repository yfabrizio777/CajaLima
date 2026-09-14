import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../lib/http'
import { parsePage, parseProduct, parseSummary } from './types'
import type { RequestOptions } from '../../lib/http'
export function useProductsApi() {
  const { authenticatedRequest } = useAuth()
  return useMemo(() => {
    async function call(path: string, options?: Omit<RequestOptions, 'token'>) {
      try {
        return await authenticatedRequest(`/products${path}`, options)
      } catch (error) {
        if (error instanceof ApiError && error.status === 409)
          throw new ApiError(409, 'Ese código ya está en uso. Prueba con otro.')
        if (error instanceof ApiError && error.status === 404)
          throw new ApiError(404, 'Este producto ya no está disponible.')
        throw error
      }
    }
    return {
      list: async (
        search: string,
        filter: string,
        page: number,
        signal?: AbortSignal,
      ) => {
        const params = new URLSearchParams({
          search,
          page: String(page),
          size: '20',
        })
        if (filter === 'low') {
          params.set('active', 'true')
          params.set('lowStock', 'true')
        }
        if (filter === 'inactive') params.set('active', 'false')
        return parsePage(await call(`?${params}`, { signal }))
      },
      summary: async (signal?: AbortSignal) =>
        parseSummary(await call('/summary', { signal })),
      save: async (id: number | undefined, body: unknown) =>
        parseProduct(
          await call(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body }),
        ),
      status: async (id: number, active: boolean) =>
        parseProduct(
          await call(`/${id}/status`, { method: 'PATCH', body: { active } }),
        ),
      adjust: async (id: number, newStock: number, reason: string) =>
        parseProduct(
          await call(`/${id}/stock-adjustments`, {
            method: 'POST',
            body: { newStock, reason },
          }),
        ),
    }
  }, [authenticatedRequest])
}
