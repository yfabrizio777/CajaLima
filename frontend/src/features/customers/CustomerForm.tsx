import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { useCustomersApi } from './api'
import { documentTypes } from './types'
import type { Customer } from './types'
import { customerBody, validateCustomer } from './validation'
import type { CustomerErrors, CustomerValues } from './validation'

export function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer
  onClose: () => void
  onSaved: (customer: Customer) => void
}) {
  const api = useCustomersApi()
  const [values, setValues] = useState<CustomerValues>({
    name: customer?.name ?? '',
    documentType: customer?.documentType ?? '',
    documentNumber: customer?.documentNumber ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    notes: customer?.notes ?? '',
  })
  const [more, setMore] = useState(
    Boolean(customer?.email || customer?.address || customer?.notes),
  )
  const [errors, setErrors] = useState<CustomerErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  function update(key: keyof CustomerValues, value: string) {
    setValues({ ...values, [key]: value })
    setErrors({ ...errors, [key]: undefined })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const invalid = validateCustomer(values)
    setErrors(invalid)
    setMessage('')
    const first = Object.keys(invalid)[0]
    if (first) {
      if (['email', 'address', 'notes'].includes(first)) setMore(true)
      requestAnimationFrame(() =>
        document.getElementById(`customer-${first}`)?.focus(),
      )
      return
    }
    setBusy(true)
    try {
      const saved = await api.save(customer?.id, customerBody(values))
      onSaved(saved)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos guardar el cliente.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={customer ? 'Editar cliente' : 'Nuevo cliente'}
      onClose={onClose}
      busy={busy}
    >
      <p className="dialog-intro">
        Solo necesitamos su nombre. Completa los demás datos cuando te sirvan.
      </p>
      {message && (
        <p role="alert" className="form-alert">
          {message}
        </p>
      )}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <Field
          id="customer-name"
          label="Nombre"
          required
          maxLength={160}
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
        />
        <div className="form-columns">
          <div className="field">
            <label htmlFor="customer-documentType">
              Tipo de documento (opcional)
            </label>
            <select
              id="customer-documentType"
              className="input"
              value={values.documentType}
              aria-invalid={errors.documentType ? true : undefined}
              aria-describedby={
                errors.documentType ? 'customer-documentType-error' : undefined
              }
              onChange={(e) => update('documentType', e.target.value)}
            >
              <option value="">Sin especificar</option>
              {Object.entries(documentTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.documentType && (
              <p id="customer-documentType-error" className="field-error">
                {errors.documentType}
              </p>
            )}
          </div>
          <Field
            id="customer-documentNumber"
            label="Número de documento (opcional)"
            maxLength={64}
            value={values.documentNumber}
            error={errors.documentNumber}
            onChange={(e) => update('documentNumber', e.target.value)}
          />
        </div>
        <Field
          id="customer-phone"
          label="Teléfono (opcional)"
          type="tel"
          maxLength={64}
          autoComplete="tel"
          value={values.phone}
          error={errors.phone}
          onChange={(e) => update('phone', e.target.value)}
        />
        <details
          className="customer-more"
          open={more}
          onToggle={(e) => setMore(e.currentTarget.open)}
        >
          <summary>Agregar correo, dirección o una nota</summary>
          <Field
            id="customer-email"
            label="Correo (opcional)"
            type="email"
            maxLength={180}
            autoComplete="email"
            value={values.email}
            error={errors.email}
            onChange={(e) => update('email', e.target.value)}
          />
          <Field
            id="customer-address"
            label="Dirección (opcional)"
            maxLength={240}
            autoComplete="street-address"
            value={values.address}
            error={errors.address}
            onChange={(e) => update('address', e.target.value)}
          />
          <div className="field">
            <label htmlFor="customer-notes">Nota (opcional)</label>
            <textarea
              id="customer-notes"
              className="input"
              rows={3}
              maxLength={1000}
              value={values.notes}
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={
                errors.notes ? 'customer-notes-error' : 'customer-notes-hint'
              }
              onChange={(e) => update('notes', e.target.value)}
            />
            <p id="customer-notes-hint" className="field-hint">
              Hasta 1000 caracteres. Guarda solo información útil para
              atenderle.
            </p>
            {errors.notes && (
              <p id="customer-notes-error" className="field-error">
                {errors.notes}
              </p>
            )}
          </div>
        </details>
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
          >
            {busy ? 'Guardando…' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
