import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../lib/http'
import { parsePage } from '../products/types'
import { parseSale, parseSales, parseSaleSummary } from './types'
import type { SaleRequest } from './types'
export function useSalesApi() {
  const { authenticatedRequest } = useAuth()
  return useMemo(
    () => ({
      products: async (search: string, page: number, signal?: AbortSignal) =>
        parsePage(
          await authenticatedRequest(
            '/products?' +
              new URLSearchParams({
                search,
                page: String(page),
                size: '12',
                active: 'true',
              }),
            { signal },
          ),
        ),
      create: async (body: SaleRequest) => {
        try {
          return parseSale(
            await authenticatedRequest('/sales', { method: 'POST', body }),
          )
        } catch (error) {
          if (error instanceof ApiError && [404, 409].includes(error.status))
            throw new ApiError(
              error.status,
              'Un producto o su stock cambió. Revisa las cantidades antes de registrar la venta.',
            )
          throw error
        }
      },
      list: async (date: string, page: number, signal?: AbortSignal) =>
        parseSales(
          await authenticatedRequest(
            '/sales?' +
              new URLSearchParams({
                ...(date ? { date } : {}),
                page: String(page),
                size: '20',
              }),
            { signal },
          ),
        ),
      detail: async (id: number, signal?: AbortSignal) =>
        parseSale(await authenticatedRequest('/sales/' + id, { signal })),
      summary: async (signal?: AbortSignal) =>
        parseSaleSummary(
          await authenticatedRequest('/sales/summary', { signal }),
        ),
    }),
    [authenticatedRequest],
  )
}
