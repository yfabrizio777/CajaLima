import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../lib/http'
import { collectionMethods } from '../../lib/payments'
import {
  categories,
  createBody,
  initialSpending,
  validateSpending,
} from './types'
import type { Kind, SpendingRow, Values } from './types'
import { useSpendingApi } from './api'
import { readIntent, saveIntent, clearIntent } from './intent'
import { PurchaseLines } from './PurchaseLines'

export function SpendingForm({
  kind,
  record,
  onClose,
  onSaved,
}: {
  kind: Kind
  record?: SpendingRow
  onClose: () => void
  onSaved: () => void
}) {
  const api = useSpendingApi(kind),
    actor = useAuth().user?.id ?? 0
  const [restored] = useState(() => (record ? null : readIntent(actor, kind)))
  const [values, setValues] = useState<Values>(
    () =>
      restored?.values ??
      (record
        ? {
            ...initialSpending(),
            description: record.description,
            notes: record.notes ?? '',
            supplierName: record.supplierName ?? '',
          }
        : initialSpending()),
  )
  const [requestId, setRequestId] = useState(
    restored?.requestId ?? crypto.randomUUID(),
  )
  const [uncertain, setUncertain] = useState(Boolean(restored))
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const locked = busy || uncertain
  function update(key: keyof Values, value: string) {
    setValues({ ...values, [key]: value })
    setErrors({ ...errors, [key]: '' })
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const invalid = validateSpending(kind, values, Boolean(record))
    setErrors(invalid)
    const first = Object.keys(invalid)[0]
    if (first) {
      document.getElementById(first)?.focus()
      return
    }
    setMessage('')
    setBusy(true)
    let dispatched = false
    try {
      if (!record) saveIntent(actor, kind, { requestId, values })
      dispatched = true
      await api.save(
        record
          ? {
              description: values.description.trim(),
              notes: values.notes.trim() || null,
              ...(kind === 'purchases'
                ? { supplierName: values.supplierName.trim() || null }
                : {}),
            }
          : createBody(kind, values, requestId),
        record?.id,
      )
      if (!record) clearIntent(actor, kind)
      onSaved()
    } catch (e) {
      const unknown =
        dispatched &&
        !record &&
        (!(e instanceof ApiError) ||
          e.status === 0 ||
          e.status >= 500 ||
          e.status === 409 ||
          e.status === 401 ||
          e.status === 403)
      if (unknown) setUncertain(true)
      else if (!record && dispatched) {
        clearIntent(actor, kind)
        setUncertain(false)
        setRequestId(crypto.randomUUID())
      }
      setMessage(
        e instanceof Error ? e.message : 'No pudimos guardar el registro.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={
        record
          ? 'Editar datos'
          : kind === 'expenses'
            ? 'Registrar gasto'
            : 'Registrar compra'
      }
      onClose={onClose}
      busy={busy}
    >
      <p className="dialog-intro">
        {record
          ? 'Solo puedes corregir la descripción, proveedor y notas. Los datos financieros se conservan.'
          : kind === 'expenses'
            ? 'Registra en qué se va el dinero de tu negocio.'
            : 'Registra mercadería que entra a tu negocio.'}
      </p>
      {uncertain && (
        <output className="form-alert">
          El resultado está pendiente de confirmar. Usa «Comprobar y reintentar»
          con los mismos datos. Puedes cerrar y recuperar esta solicitud en la
          misma pestaña; si sales de ella, revisa primero el historial.
        </output>
      )}
      {uncertain && (
        <p className="field-hint">
          Si confirmaste en el historial que esta operación no existe, puedes
          corregir los datos. Conservaremos la misma referencia para evitar
          duplicarla.
        </p>
      )}
      {message && (
        <p role="alert" className="form-alert">
          {message}
        </p>
      )}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <Field
          id="description"
          label="Descripción"
          required
          maxLength={160}
          value={values.description}
          disabled={locked}
          error={errors.description}
          onChange={(e) => update('description', e.target.value)}
        />
        {kind === 'purchases' && (
          <Field
            id="supplierName"
            label="Proveedor (opcional)"
            maxLength={160}
            value={values.supplierName}
            disabled={locked}
            error={errors.supplierName}
            onChange={(e) => update('supplierName', e.target.value)}
          />
        )}
        {!record && (
          <>
            {kind === 'expenses' ? (
              <>
                <div className="field">
                  <label htmlFor="category">Categoría *</label>
                  <select
                    id="category"
                    className="input"
                    required
                    disabled={locked}
                    value={values.category}
                    aria-invalid={Boolean(errors.category)}
                    aria-describedby={
                      errors.category ? 'category-error' : undefined
                    }
                    onChange={(e) => update('category', e.target.value)}
                  >
                    {Object.entries(categories).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="field-error" id="category-error">
                      {errors.category}
                    </p>
                  )}
                </div>
                <Field
                  id="amount"
                  label="Monto (S/)"
                  required
                  inputMode="decimal"
                  disabled={locked}
                  value={values.amount}
                  error={errors.amount}
                  onChange={(e) => update('amount', e.target.value)}
                />
              </>
            ) : (
              <PurchaseLines
                lines={values.items}
                disabled={locked}
                error={errors.items}
                onChange={(items) => {
                  setValues({ ...values, items })
                  setErrors({ ...errors, items: '' })
                }}
              />
            )}
            <div className="form-columns">
              <div className="field">
                <label htmlFor="paymentMethod">¿Cómo pagaste?</label>
                <select
                  id="paymentMethod"
                  className="input"
                  disabled={locked}
                  value={values.paymentMethod}
                  onChange={(e) => update('paymentMethod', e.target.value)}
                >
                  {Object.entries(collectionMethods).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                id="date"
                label="Fecha"
                type="date"
                required
                min="2000-01-01"
                max="2100-12-31"
                disabled={locked}
                value={values.date}
                error={errors.date}
                onChange={(e) => update('date', e.target.value)}
              />
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="notes">Notas (opcional)</label>
          <textarea
            className="input"
            id="notes"
            maxLength={500}
            value={values.notes}
            disabled={locked}
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={errors.notes ? 'notes-error' : undefined}
            onChange={(e) => update('notes', e.target.value)}
          />
          {errors.notes && (
            <p className="field-error" id="notes-error">
              {errors.notes}
            </p>
          )}
        </div>
        <div className="dialog-actions">
          {uncertain && (
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => {
                setUncertain(false)
                setMessage(
                  'Revisa los datos. Si esta referencia ya se registró, no podrás reutilizarla con otros importes.',
                )
              }}
            >
              Revisé el historial, corregir datos
            </button>
          )}
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
          >
            {busy
              ? 'Guardando…'
              : uncertain
                ? 'Comprobar y reintentar'
                : record
                  ? 'Guardar datos'
                  : kind === 'expenses'
                    ? 'Registrar gasto'
                    : 'Registrar compra'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
