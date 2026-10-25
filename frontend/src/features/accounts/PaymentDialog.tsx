import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { formatAccountMoney } from './money'
import { collectionMethods } from '../../lib/payments'
import type { CollectionMethod } from '../../lib/payments'
import { ApiError } from '../../lib/http'
import { useAccountApi } from './api'
import { validatePayment } from './types'
import {
  readPaymentIntent,
  savePaymentIntent,
  clearPaymentIntent,
} from './paymentIntent'

export function PaymentDialog({
  customerId,
  actorId,
  balance,
  onClose,
  onSaved,
}: {
  customerId: number
  actorId: number
  balance: string
  onClose: () => void
  onSaved: () => void
}) {
  const api = useAccountApi()
  const [pending] = useState(() => readPaymentIntent(actorId, customerId))
  const [amount, setAmount] = useState(pending?.amount ?? '')
  const [method, setMethod] = useState<CollectionMethod>(
    pending?.paymentMethod ?? 'CASH',
  )
  const [note, setNote] = useState(pending?.note ?? '')
  const [requestId, setRequestId] = useState(
    () => pending?.requestId ?? crypto.randomUUID(),
  )
  const [errors, setErrors] = useState<ReturnType<typeof validatePayment>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(Boolean(pending))
  const locked = busy || uncertain
  function changed() {
    setRequestId(crypto.randomUUID())
    setErrors({})
    setMessage('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const invalid = validatePayment(
      amount,
      method,
      note,
      uncertain ? amount : balance,
    )
    setErrors(invalid)
    const first = Object.keys(invalid)[0]
    if (first) {
      document.getElementById(`payment-${first}`)?.focus()
      return
    }
    const body = {
      requestId,
      amount,
      paymentMethod: method,
      note: note.trim() || null,
    }
    try {
      savePaymentIntent(actorId, customerId, body)
    } catch {
      setMessage(
        'No pudimos conservar la referencia del pago en esta pestaña. Revisa el almacenamiento del navegador antes de registrar.',
      )
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await api.pay(customerId, body)
      clearPaymentIntent(actorId, customerId)
      onSaved()
    } catch (error) {
      const unknown =
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500 ||
        (uncertain && [401, 403].includes(error.status))
      if (!unknown) clearPaymentIntent(actorId, customerId)
      setUncertain(unknown)
      setMessage(
        unknown
          ? 'No pudimos confirmar la respuesta. Conserva este pago y usa Comprobar y reintentar para evitar registrarlo dos veces.'
          : error.message,
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog title="Registrar pago" onClose={onClose} busy={locked}>
      <p className="dialog-intro">
        Saldo pendiente: <strong>{formatAccountMoney(balance)}</strong>
      </p>
      {pending && (
        <output>
          Hay un pago pendiente de comprobar en esta pestaña. Conservaremos su
          referencia al reintentar.
        </output>
      )}
      {message && (
        <p role="alert" className="form-alert">
          {message}
        </p>
      )}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <Field
          id="payment-amount"
          label="Monto (S/)"
          inputMode="decimal"
          required
          disabled={locked}
          value={amount}
          error={errors.amount}
          onChange={(e) => {
            setAmount(e.target.value)
            changed()
          }}
        />
        <fieldset className="payment-options" disabled={locked}>
          <legend>¿Cómo pagó?</legend>
          {Object.entries(collectionMethods).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="debt-payment-method"
                value={value}
                checked={method === value}
                onChange={() => {
                  setMethod(value as CollectionMethod)
                  changed()
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <Field
          id="payment-note"
          label="Nota (opcional)"
          maxLength={240}
          disabled={locked}
          value={note}
          error={errors.note}
          onChange={(e) => {
            setNote(e.target.value)
            changed()
          }}
        />
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            disabled={locked}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
          >
            {busy
              ? 'Registrando…'
              : uncertain
                ? 'Comprobar y reintentar'
                : 'Registrar pago'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
