import { useEffect, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { useCustomersApi } from './api'
import { customerDocument } from './types'
import type { Customer } from './types'

export function CustomerDetail({
  id,
  onClose,
}: {
  id: number
  onClose: () => void
}) {
  const api = useCustomersApi()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api
      .detail(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setCustomer(value)
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'No pudimos consultar el cliente.',
          )
      })
    return () => controller.abort()
  }, [api, id, revision])
  return (
    <Dialog title="Información del cliente" onClose={onClose}>
      {error ? (
        <div role="alert" className="form-alert">
          {error}
          <button
            className="button button-secondary"
            onClick={() => {
              setError('')
              setRevision((value) => value + 1)
            }}
          >
            Volver a intentar
          </button>
        </div>
      ) : !customer ? (
        <output>Consultando cliente…</output>
      ) : (
        <dl className="customer-detail">
          {Object.entries({
            Cliente: customer.name,
            Documento: customerDocument(customer),
            Teléfono: customer.phone || 'Sin teléfono',
            Estado: customer.active ? 'Activo' : 'Inactivo',
            Correo: customer.email || 'Sin correo',
            Dirección: customer.address || 'Sin dirección',
            Nota: customer.notes || 'Sin nota',
          }).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="dialog-actions">
        <button className="button button-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Dialog>
  )
}
