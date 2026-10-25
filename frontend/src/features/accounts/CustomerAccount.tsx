import { useEffect, useState } from 'react'
import { formatMoney, formatDate } from '../../lib/locale'
import { formatAccountMoney } from './money'
import { useAuth } from '../auth/AuthContext'
import { readPaymentIntent } from './paymentIntent'
import { collectionMethods } from '../../lib/payments'
import { KusiNote } from '../../components/ui/KusiNote'
import { useAccountApi } from './api'
import { PaymentDialog } from './PaymentDialog'
import type { CustomerAccount as Account, MovementPage } from './types'

export function CustomerAccount({
  customerId,
  active,
}: {
  customerId: number
  active: boolean
}) {
  const api = useAccountApi()
  const actorId = useAuth().user?.id ?? 0
  const [pending, setPending] = useState(() =>
    Boolean(readPaymentIntent(actorId, customerId)),
  )
  const [account, setAccount] = useState<Account | null>(null)
  const [movements, setMovements] = useState<MovementPage | null>(null)
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [notice, setNotice] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      api.account(customerId, controller.signal),
      api.movements(customerId, page, controller.signal),
    ])
      .then(([summary, history]) => {
        if (!controller.signal.aborted) {
          setAccount(summary)
          setMovements(history)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error ? e.message : 'No pudimos consultar la cuenta.',
          )
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [api, customerId, page, revision])
  function reload() {
    setError('')
    setLoading(true)
    setRevision((value) => value + 1)
  }
  return (
    <section className="customer-account" aria-labelledby="account-title">
      <h3 id="account-title">Saldo pendiente</h3>
      {loading ? (
        <output>Consultando cuenta…</output>
      ) : error ? (
        <div className="form-alert" role="alert">
          {error}
          <button className="button button-secondary" onClick={reload}>
            Volver a intentar
          </button>
        </div>
      ) : (
        account &&
        movements && (
          <>
            <p className="account-balance">
              {formatAccountMoney(account.outstandingBalance)}
            </p>
            {pending ? (
              <button
                className="button button-primary"
                onClick={() => setPaying(true)}
              >
                Comprobar pago pendiente
              </button>
            ) : account.outstandingBalance === '0.00' ? (
              <p>No tiene saldo pendiente.</p>
            ) : active ? (
              <button
                className="button button-primary"
                onClick={() => {
                  setNotice(false)
                  setPaying(true)
                }}
              >
                Registrar pago
              </button>
            ) : (
              <p>Reactiva al cliente para registrar un pago.</p>
            )}
            {notice && (
              <KusiNote>Pago registrado. El saldo quedó actualizado.</KusiNote>
            )}
            <h4>Movimientos</h4>
            {movements.items.length ? (
              <ul className="account-movements">
                {movements.items.map((m) => (
                  <li key={m.id}>
                    <div>
                      <strong>
                        {m.type === 'CREDIT'
                          ? 'Venta fiada'
                          : `Pago ${m.paymentMethod ? collectionMethods[m.paymentMethod] : ''}`}
                      </strong>
                      <span>
                        {formatDate(new Date(m.createdAt))} · {m.createdByName}
                      </span>
                      {m.saleId && <span>Venta #{m.saleId}</span>}
                      {m.note && <span>{m.note}</span>}
                    </div>
                    <strong
                      className={
                        m.type === 'CREDIT'
                          ? 'account-credit'
                          : 'account-payment'
                      }
                    >
                      {m.type === 'CREDIT' ? '+' : '-'} {formatMoney(m.amount)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Todavía no hay movimientos en esta cuenta.</p>
            )}
            {movements.total > movements.size && (
              <nav
                className="pagination"
                aria-label="Páginas de movimientos de cuenta"
              >
                <button
                  disabled={page === 0}
                  onClick={() => {
                    setPage(page - 1)
                    setLoading(true)
                  }}
                >
                  Anterior
                </button>
                <span>
                  Página {page + 1} de{' '}
                  {Math.ceil(movements.total / movements.size)}
                </span>
                <button
                  disabled={(page + 1) * movements.size >= movements.total}
                  onClick={() => {
                    setPage(page + 1)
                    setLoading(true)
                  }}
                >
                  Siguiente
                </button>
              </nav>
            )}
          </>
        )
      )}
      {paying && account && (
        <PaymentDialog
          customerId={customerId}
          actorId={actorId}
          balance={account.outstandingBalance}
          onClose={() => {
            setPending(Boolean(readPaymentIntent(actorId, customerId)))
            setPaying(false)
            reload()
          }}
          onSaved={() => {
            setPending(false)
            setPaying(false)
            setNotice(true)
            setPage(0)
            reload()
          }}
        />
      )}
    </section>
  )
}
