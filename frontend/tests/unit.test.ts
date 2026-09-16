import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changeQuantity, cartTotal } from '../src/features/sales/cartState.ts'
import {
  parseSale,
  parseSaleSummary,
  payments,
} from '../src/features/sales/types.ts'
import type { Product } from '../src/features/products/types.ts'

const saleProduct: Product = {
  id: 1,
  name: 'Inca Kola',
  sku: 'IK500',
  salePrice: 3.5,
  costPrice: null,
  stock: 24,
  minimumStock: 5,
  active: true,
  lowStock: false,
  createdAt: '2026-09-14T12:00:00Z',
  updatedAt: '2026-09-14T12:00:00Z',
}
test('carrito vacío y agregar producto', () => {
  assert.equal(cartTotal([]), 0)
  assert.equal(changeQuantity([], saleProduct, 2)[0]?.quantity, 2)
})
test('carrito incrementa, disminuye y elimina sin duplicar líneas', () => {
  const cart = changeQuantity([], saleProduct, 2)
  const next = changeQuantity(cart, saleProduct, 3)
  assert.equal(next.length, 1)
  assert.equal(next[0]?.quantity, 3)
  assert.equal(changeQuantity(next, saleProduct, 1)[0]?.quantity, 1)
  assert.deepEqual(changeQuantity(next, saleProduct, 0), [])
})
test('carrito respeta stock, cantidades e inactivos', () => {
  for (const quantity of [-1, 1.5, 25, NaN])
    assert.deepEqual(changeQuantity([], saleProduct, quantity), [])
  assert.deepEqual(changeQuantity([], { ...saleProduct, active: false }, 1), [])
})
test('total preliminar suma en céntimos', () => {
  const cart = [
    { product: saleProduct, quantity: 2 },
    { product: { ...saleProduct, id: 2, salePrice: 2 }, quantity: 1 },
  ]
  assert.equal(cartTotal(cart), 9)
  assert.equal(
    cartTotal([{ product: { ...saleProduct, salePrice: 0.1 }, quantity: 3 }]),
    0.3,
  )
})
test('contratos de venta y pagos manuales', () => {
  assert.equal(payments.YAPE, 'Yape')
  assert.equal(payments.CASH, 'Efectivo')
  assert.throws(() => parseSale({ total: -1 }))
  assert.throws(() =>
    parseSaleSummary({ total: NaN, count: 1, date: '2026-09-14' }),
  )
  assert.deepEqual(
    parseSaleSummary({ total: 9, count: 1, date: '2026-09-14' }),
    { total: 9, count: 1, date: '2026-09-14' },
  )
})
import { formatDate, formatMoney } from '../src/lib/locale.ts'
import { validate } from '../src/features/auth/validation.ts'
import {
  validateProduct,
  validMoney,
  validQuantity,
} from '../src/features/products/validation.ts'
import {
  parseProduct,
  parsePage,
  parseSummary,
} from '../src/features/products/types.ts'

test('productos validan dinero decimal y cantidades acotadas', () => {
  for (const value of ['-1', 'NaN', 'Infinity', '1.999', '1e3', '100000000'])
    assert.equal(validMoney(value), false)
  assert.equal(validMoney('3.50'), true)
  for (const value of ['-1', '1.5', '1000001', ''])
    assert.equal(validQuantity(value), false)
  assert.equal(validQuantity('0'), true)
})
test('nuevo producto y edición tienen campos diferentes', () => {
  const input = {
    name: 'Agua',
    sku: 'AS625',
    salePrice: '2.00',
    costPrice: '',
    initialStock: '-1',
    minimumStock: '5',
    active: true,
  }
  assert.ok(validateProduct(input, true).initialStock)
  assert.deepEqual(validateProduct(input, false), {})
  assert.ok(
    validateProduct({ ...input, name: ' ', sku: 'con espacios' }, true).sku,
  )
})
test('contratos de productos y resumen rechazan datos inválidos', () => {
  assert.throws(() => parseProduct({ stock: -1 }))
  assert.throws(() => parsePage({ items: [{}], total: 1, page: 0, size: 20 }))
  assert.throws(() => parseSummary({ activeProducts: -1, lowStockProducts: 0 }))
  assert.deepEqual(parsePage({ items: [], total: 0, page: 0, size: 20 }), {
    items: [],
    total: 0,
    page: 0,
    size: 20,
  })
  assert.deepEqual(parseSummary({ activeProducts: 2, lowStockProducts: 1 }), {
    activeProducts: 2,
    lowStockProducts: 1,
  })
})
import {
  parseUser,
  parseSetup,
  parseLogin,
} from '../src/features/auth/types.ts'

test('formatos peruanos independientes de la zona del equipo', () => {
  assert.equal(formatMoney(10), 'S/ 10.00')
  assert.equal(formatMoney(1250.5), 'S/ 1,250.50')
  assert.equal(formatDate(new Date('2026-09-13T12:00:00Z')), '13/09/2026')
})
test('setup valida identidad y confirmación; login no exige nombre', () => {
  const values = {
    name: '',
    email: 'invalid',
    password: '',
    confirmPassword: '',
  }
  assert.ok(validate(values, true).name)
  assert.ok(validate(values, true).email)
  assert.ok(validate(values, true).password)
  assert.equal(validate(values, false).name, undefined)
  assert.ok(validate({ ...values, password: 'á'.repeat(37) }, true).password)
  assert.ok(
    validate({ ...values, password: 'x'.repeat(12) }, true).confirmPassword,
  )
})
test('contrato de usuario descarta campos internos y rechaza cuentas inactivas', () => {
  const user = {
    id: 1,
    name: 'Prueba',
    email: 'test@example.invalid',
    role: 'ADMIN',
    active: true,
  }
  assert.deepEqual(parseUser({ ...user, internal: 'ignored' }), user)
  assert.throws(() => parseUser({ ...user, active: false }))
  assert.throws(() => parseUser({ ...user, role: 'OWNER' }))
  assert.throws(() => parseUser(null))
})
test('contratos de sesión rechazan respuestas inválidas', () => {
  assert.equal(parseSetup({ available: false }), false)
  assert.throws(() => parseSetup({ available: 'false' }))
  assert.throws(() => parseLogin({}))
  assert.throws(() =>
    parseLogin({ token: 'invalid', type: 'Bearer', expiresIn: 3600 }),
  )
})
