import { useEffect, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { useAuth } from '../auth/AuthContext'
import { useSpendingApi } from './api'
import type { Detail, Kind, SpendingRow } from './types'
import { categories } from './types'
import { collectionMethods } from '../../lib/payments'
import { formatDate } from '../../lib/locale'
import { formatAccountMoney } from '../accounts/money'
export function SpendingDetail({
  kind,
  id,
  onClose,
  onEdit,
}: {
  kind: Kind
  id: number
  onClose: () => void
  onEdit: (record: SpendingRow) => void
}) {
  const api = useSpendingApi(kind),
    admin = useAuth().user?.role === 'ADMIN'
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api
      .get(id, controller.signal)
      .then((v) => {
        if (!controller.signal.aborted) {
          setDetail(v)
          setError('')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('No pudimos consultar el registro.')
      })
    return () => controller.abort()
  }, [api, id, revision])
  return (
    <Dialog
      title={`${kind === 'expenses' ? 'Gasto' : 'Compra'} #${id}`}
      onClose={onClose}
    >
      {error ? (
        <div role="alert" className="form-alert">
          {error}
          <button
            className="button button-secondary"
            onClick={() => setRevision(revision + 1)}
          >
            Volver a intentar
          </button>
        </div>
      ) : !detail ? (
        <output>Consultando registro…</output>
      ) : (
        <>
          <h3 className="spending-description">{detail.record.description}</h3>
          <p className="account-balance">
            {formatAccountMoney(detail.record.amount)}
          </p>
          <dl className="spending-data">
            <div>
              <dt>Fecha</dt>
              <dd>{detail.record.date.split('-').reverse().join('/')}</dd>
            </div>
            <div>
              <dt>Medio de pago</dt>
              <dd>{collectionMethods[detail.record.paymentMethod]}</dd>
            </div>
            {detail.record.category && (
              <div>
                <dt>Categoría</dt>
                <dd>{categories[detail.record.category]}</dd>
              </div>
            )}
            {kind === 'purchases' && (
              <div>
                <dt>Proveedor</dt>
                <dd>
                  {detail.record.supplierName || 'Sin proveedor registrado'}
                </dd>
              </div>
            )}
            <div>
              <dt>Registrado por</dt>
              <dd>
                Usuario #{detail.record.createdBy} ·{' '}
                {formatDate(new Date(detail.record.createdAt))}
              </dd>
            </div>
            {detail.record.notes && (
              <div>
                <dt>Notas</dt>
                <dd>{detail.record.notes}</dd>
              </div>
            )}
          </dl>
          {detail.items.length > 0 && (
            <section aria-label="Productos comprados">
              <h3>Productos comprados</h3>
              {detail.items.map((i) => (
                <article className="purchase-line" key={i.id}>
                  <strong>{i.productName}</strong>
                  <p>
                    {i.quantity} unidades × {formatAccountMoney(i.unitCost)}
                  </p>
                  <strong>{formatAccountMoney(i.subtotal)}</strong>
                </article>
              ))}
            </section>
          )}
          <div className="dialog-actions">
            {admin && (
              <button
                className="button button-secondary"
                onClick={() => onEdit(detail.record)}
              >
                Editar datos
              </button>
            )}
            <button className="button button-primary" onClick={onClose}>
              Listo
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
