import { useEffect, useState } from 'react'
import { useSpendingApi } from './api'
import { formatAccountMoney } from '../accounts/money'
import type { Kind } from './types'
function Metric({ kind }: { kind: Kind }) {
  const api = useSpendingApi(kind),
    [total, setTotal] = useState<string | null>(null),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    const c = new AbortController()
    api
      .summary(c.signal)
      .then((v) => {
        if (!c.signal.aborted) setTotal(v.total)
      })
      .catch(() => {
        if (!c.signal.aborted) setFailed(true)
      })
    return () => c.abort()
  }, [api])
  return (
    <article className="metric-card">
      <div className="metric-label">
        <h3>{kind === 'expenses' ? 'Gastos de hoy' : 'Compras de hoy'}</h3>
      </div>
      <p className="metric-number">
        {total === null ? '—' : formatAccountMoney(total)}
      </p>
      <span className="metric-foot">
        {failed
          ? 'No pudimos consultar el importe.'
          : total === null
            ? 'Consultando…'
            : 'Fecha registrada · Hora de Perú'}
      </span>
    </article>
  )
}
export function SpendingMetrics() {
  return (
    <>
      <Metric kind="expenses" />
      <Metric kind="purchases" />
    </>
  )
}
