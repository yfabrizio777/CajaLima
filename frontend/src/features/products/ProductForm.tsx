import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { useProductsApi } from './api'
import { validateProduct } from './validation'
import type { ProductErrors, ProductValues } from './validation'
import type { Product } from './types'

export function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product?: Product
  onClose: () => void
  onSaved: () => void
}) {
  const api = useProductsApi()
  const [values, setValues] = useState<ProductValues>({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    salePrice: product?.salePrice.toFixed(2) ?? '',
    costPrice: product?.costPrice?.toFixed(2) ?? '',
    initialStock: '0',
    minimumStock: String(product?.minimumStock ?? 0),
    active: product?.active ?? true,
  })
  const [errors, setErrors] = useState<ProductErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  function update(key: keyof ProductValues, value: string | boolean) {
    setValues({ ...values, [key]: value })
    setErrors({ ...errors, [key]: undefined })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const invalid = validateProduct(values, !product)
    setErrors(invalid)
    setMessage('')
    const first = Object.keys(invalid)[0]
    if (first) {
      document.getElementById(first)?.focus()
      return
    }
    setBusy(true)
    const body = {
      name: values.name.trim(),
      sku: values.sku.trim() || null,
      salePrice: values.salePrice,
      costPrice: values.costPrice || null,
      minimumStock: Number(values.minimumStock),
    }
    try {
      await api.save(
        product?.id,
        product
          ? body
          : {
              ...body,
              initialStock: Number(values.initialStock),
              active: values.active,
            },
      )
      onSaved()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos guardar el producto.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={product ? 'Editar producto' : 'Nuevo producto'}
      onClose={onClose}
      busy={busy}
    >
      <p className="dialog-intro">
        {product
          ? 'Actualiza sus datos. Para cambiar las unidades usa Ajustar stock.'
          : 'Empieza con lo esencial. Podrás actualizarlo después.'}
      </p>
      {message && (
        <p role="alert" className="form-alert">
          {message}
        </p>
      )}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <Field
          id="name"
          label="Nombre"
          required
          maxLength={160}
          value={values.name}
          error={errors.name}
          onChange={(e) => update('name', e.target.value)}
        />
        <Field
          id="sku"
          label="Código / SKU (opcional)"
          maxLength={64}
          value={values.sku}
          error={errors.sku}
          onChange={(e) => update('sku', e.target.value)}
          hint="Tu código interno. Por ejemplo: IK500."
        />
        <div className="form-columns">
          <Field
            id="salePrice"
            label="Precio de venta (S/)"
            inputMode="decimal"
            required
            value={values.salePrice}
            error={errors.salePrice}
            onChange={(e) => update('salePrice', e.target.value)}
            placeholder="0.00"
          />
          <Field
            id="costPrice"
            label="Costo (S/, opcional)"
            inputMode="decimal"
            value={values.costPrice}
            error={errors.costPrice}
            onChange={(e) => update('costPrice', e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="form-columns">
          {!product && (
            <Field
              id="initialStock"
              label="Stock inicial"
              inputMode="numeric"
              required
              value={values.initialStock}
              error={errors.initialStock}
              onChange={(e) => update('initialStock', e.target.value)}
            />
          )}
          <Field
            id="minimumStock"
            label="Avisarme cuando queden..."
            inputMode="numeric"
            required
            value={values.minimumStock}
            error={errors.minimumStock}
            onChange={(e) => update('minimumStock', e.target.value)}
            hint="Unidades o menos."
          />
        </div>
        {!product && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(e) => update('active', e.target.checked)}
            />
            Producto activo
          </label>
        )}
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
            {busy ? 'Guardando…' : 'Guardar producto'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
