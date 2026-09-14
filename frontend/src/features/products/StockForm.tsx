import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { useProductsApi } from './api'
import { validQuantity } from './validation'
import type { Product } from './types'
export function StockForm({
  product,
  onClose,
  onSaved,
}: {
  product: Product
  onClose: () => void
  onSaved: () => void
}) {
  const api = useProductsApi()
  const [stock, setStock] = useState(String(product.stock))
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ stock?: string; reason?: string }>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const invalid: typeof errors = {}
    if (!validQuantity(stock) || Number(stock) === product.stock)
      invalid.stock = 'Escribe una cantidad diferente, entre 0 y 1 000 000.'
    if (!reason.trim() || reason.trim().length > 240)
      invalid.reason = 'Cuéntanos el motivo del ajuste (hasta 240 caracteres).'
    setErrors(invalid)
    if (invalid.stock || invalid.reason) {
      document.getElementById(invalid.stock ? 'newStock' : 'reason')?.focus()
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await api.adjust(product.id, Number(stock), reason.trim())
      onSaved()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No pudimos ajustar el stock.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog title="Ajustar stock" onClose={onClose} busy={busy}>
      <p className="dialog-intro">
        <strong>{product.name}</strong>
        <br />
        Stock actual: {product.stock} unidades
      </p>
      <p className="field-hint">
        El ajuste quedará registrado con tu cuenta y el motivo.
      </p>
      {message && (
        <p role="alert" className="form-alert">
          {message}
        </p>
      )}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <Field
          id="newStock"
          label="Nuevo stock"
          required
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          error={errors.stock}
        />
        <Field
          id="reason"
          label="Motivo"
          required
          maxLength={240}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={errors.reason}
          hint="Por ejemplo: Conteo físico, Producto dañado o Corrección de inventario."
        />
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Guardando…' : 'Confirmar ajuste'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
