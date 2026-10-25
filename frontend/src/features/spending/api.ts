import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../lib/http'
import { parseDetail, parseSpendingPage, object, validDate } from './types'
import type { Kind } from './types'
import { accountMoney } from '../accounts/money'
export function useSpendingApi(kind: Kind) {
  const { authenticatedRequest } = useAuth()
  return useMemo(
    () => ({
      list: async (params: URLSearchParams, signal?: AbortSignal) =>
        parseSpendingPage(
          kind,
          await authenticatedRequest(`/${kind}?${params}`, { signal }),
        ),
      get: async (id: number, signal?: AbortSignal) =>
        parseDetail(
          kind,
          await authenticatedRequest(`/${kind}/${id}`, { signal }),
        ),
      summary: async (signal?: AbortSignal) => {
        const v = await authenticatedRequest(`/${kind}/summary`, { signal })
        if (!object(v) || !validDate(v.date))
          throw new Error('No pudimos consultar el resumen.')
        return { total: accountMoney(v.total), date: v.date }
      },
      save: async (body: unknown, id?: number) => {
        try {
          return parseDetail(
            kind,
            await authenticatedRequest(
              `/${kind}${id ? `/${id}/details` : ''}`,
              { method: id ? 'PUT' : 'POST', body },
            ),
          )
        } catch (e) {
          if (e instanceof ApiError && e.status === 409)
            throw new ApiError(
              409,
              'No pudimos confirmar esta solicitud. Revisa el historial y comprueba con la misma referencia antes de registrar otra operación.',
            )
          if (e instanceof ApiError && e.status === 404)
            throw new ApiError(
              404,
              'No encontramos el registro o uno de sus productos.',
            )
          throw e
        }
      },
    }),
    [authenticatedRequest, kind],
  )
}
