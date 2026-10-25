import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../lib/http'
import {
  parseAccount,
  parseAccountMovement,
  parseAccountMovements,
} from './types'
import type { CollectionMethod } from '../../lib/payments'
export function useAccountApi() {
  const { authenticatedRequest } = useAuth()
  return useMemo(
    () => ({
      account: async (id: number, signal?: AbortSignal) =>
        parseAccount(
          await authenticatedRequest(`/customers/${id}/account`, { signal }),
        ),
      movements: async (id: number, page: number, signal?: AbortSignal) =>
        parseAccountMovements(
          await authenticatedRequest(
            `/customers/${id}/account/movements?` +
              new URLSearchParams({ page: String(page), size: '10' }),
            { signal },
          ),
        ),
      pay: async (
        id: number,
        body: {
          requestId: string
          amount: string
          paymentMethod: CollectionMethod
          note: string | null
        },
      ) => {
        try {
          return parseAccountMovement(
            await authenticatedRequest(`/customers/${id}/payments`, {
              method: 'POST',
              body,
            }),
          )
        } catch (error) {
          if (error instanceof ApiError && error.status === 409)
            throw new ApiError(
              409,
              'El pago supera el saldo disponible o la cuenta cambió. Revisa los movimientos antes de volver a pagar.',
            )
          if (error instanceof ApiError && error.status === 404)
            throw new ApiError(404, 'No encontramos este cliente.')
          throw error
        }
      },
    }),
    [authenticatedRequest],
  )
}
