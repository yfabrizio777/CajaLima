import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  readPaymentIntent,
  savePaymentIntent,
  clearPaymentIntent,
} from '../src/features/accounts/paymentIntent.ts'
import { formatAccountMoney } from '../src/features/accounts/money.ts'
import {
  collectionMethods,
  payments as salePayments,
} from '../src/lib/payments.ts'
import {
  parseAccount,
  parseAccountMovements,
  validatePayment,
} from '../src/features/accounts/types.ts'
import { creditSaleError } from '../src/features/sales/creditValidation.ts'
import {
  validateSpending,
  purchaseTotal,
  parseSpendingPage,
  initialSpending,
  parseDetail,
} from '../src/features/spending/types.ts'
import {
  readIntent,
  saveIntent,
  clearIntent,
} from '../src/features/spending/intent.ts'

test('gastos validan monto categoria fecha y medio manual', () => {
  const values = {
    ...initialSpending(),
    description: 'Movilidad',
    amount: '12.50',
    category: 'TRANSPORT',
  }
  assert.deepEqual(validateSpending('expenses', values), {})
  for (const amount of ['0', '-1', '1.001', '1e2', '1000000000000'])
    assert.ok(validateSpending('expenses', { ...values, amount }).amount)
  assert.ok(
    validateSpending('expenses', { ...values, paymentMethod: 'CREDIT' })
      .paymentMethod,
  )
  assert.ok(
    validateSpending('expenses', { ...values, date: '2026-02-30' }).date,
  )
  assert.ok(
    validateSpending('expenses', { ...values, category: 'BAD' }).category,
  )
})
test('compras calculan centimos y validan lineas duplicadas limites y cantidades', () => {
  const values = {
    ...initialSpending(),
    description: 'Reposición',
    items: [
      { productId: 1, productName: 'Arroz', quantity: '3', unitCost: '0.10' },
    ],
  }
  assert.equal(purchaseTotal(values.items), '0.30')
  assert.deepEqual(validateSpending('purchases', values), {})
  assert.ok(validateSpending('purchases', { ...values, items: [] }).items)
  assert.ok(
    validateSpending('purchases', {
      ...values,
      items: [...values.items, ...values.items],
    }).items,
  )
  for (const quantity of ['0', '-1', '1.5', '1000001'])
    assert.ok(
      validateSpending('purchases', {
        ...values,
        items: [{ ...values.items[0]!, quantity }],
      }).items,
    )
  assert.ok(
    validateSpending('purchases', {
      ...values,
      items: [
        { ...values.items[0]!, quantity: '1000000', unitCost: '99999999.99' },
      ],
    }).items,
  )
})
test('listados financieros admiten vacio y rechazan respuestas invalidas', () => {
  assert.deepEqual(
    parseSpendingPage('expenses', { items: [], total: 0, page: 0, size: 20 })
      .items,
    [],
  )
  assert.throws(() =>
    parseSpendingPage('expenses', {
      items: [{ amount: '-1' }],
      total: 1,
      page: 0,
      size: 20,
    }),
  )
})
test('contrato de compra verifica subtotales total y snapshots sin exponer internos', () => {
  const purchase = {
    id: 1,
    description: 'Reposición',
    supplierName: null,
    total: '0.30',
    paymentMethod: 'YAPE',
    purchaseDate: '2026-10-25',
    notes: null,
    createdBy: 2,
    createdAt: '2026-10-25T12:00:00Z',
    updatedAt: '2026-10-25T12:00:00Z',
    requestFingerprint: 'interno',
  }
  const items = [
    {
      id: 1,
      productId: 3,
      productName: 'Arroz',
      quantity: 3,
      unitCost: '0.10',
      subtotal: '0.30',
    },
  ]
  const detail = parseDetail('purchases', { purchase, items })
  assert.equal(detail.record.amount, '0.30')
  assert.equal('requestFingerprint' in detail.record, false)
  assert.throws(() =>
    parseDetail('purchases', {
      purchase: { ...purchase, total: '0.31' },
      items,
    }),
  )
  assert.throws(() =>
    parseDetail('purchases', {
      purchase,
      items: [{ ...items[0]!, subtotal: '0.29' }],
    }),
  )
})
test('intencion financiera conserva UUID y payload por actor y modulo hasta resolver', () => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  const intent = {
    requestId: '11111111-1111-4111-8111-111111111111',
    values: { ...initialSpending(), description: 'Movilidad', amount: '12.50' },
  }
  saveIntent(1, 'expenses', intent)
  assert.deepEqual(readIntent(1, 'expenses'), intent)
  assert.equal(readIntent(2, 'expenses'), null)
  assert.equal(readIntent(1, 'purchases'), null)
  assert.equal(JSON.stringify([...storage.values()]).includes('token'), false)
  clearIntent(1, 'expenses')
  assert.equal(readIntent(1, 'expenses'), null)
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: () => '{invalid',
      setItem: () => {
        throw new Error('disabled')
      },
      removeItem: () => {},
    },
  })
  assert.equal(readIntent(1, 'expenses'), null)
  assert.throws(() => saveIntent(1, 'expenses', intent))
})

test('fiado requiere cliente y solo admite importe positivo', () => {
  assert.equal(salePayments.CREDIT, 'Fiado')
  assert.equal('CREDIT' in collectionMethods, false)
  assert.equal(creditSaleError('CASH', null, 30), '')
  assert.equal(
    creditSaleError('CREDIT', null, 30),
    'Selecciona un cliente para registrar una venta fiada.',
  )
  assert.ok(creditSaleError('CREDIT', 1, 0))
  assert.equal(creditSaleError('CREDIT', 1, 30), '')
})
test('pagos validan centimos, limites y saldo sin aceptar credito como cobro', () => {
  assert.deepEqual(validatePayment('10.00', 'YAPE', '', 30), {})
  for (const amount of ['0', '-1', '30.01', '1.001', 'NaN', '1e1', ''])
    assert.ok(validatePayment(amount, 'CASH', '', 30).amount)
  assert.ok(validatePayment('1', 'CREDIT', '', 30).paymentMethod)
  assert.ok(validatePayment('1', 'CASH', 'x'.repeat(241), 30).note)
  assert.ok(validatePayment('1', 'CASH', '', 0).amount)
})
test('cuenta valida saldo derivado, movimientos y cliente sin deuda', () => {
  const account = {
    customerId: 1,
    customerName: 'María',
    outstandingBalance: 20,
    totalCredit: 30,
    totalPaid: 10,
    lastMovementAt: '2026-10-25T12:00:00Z',
  }
  assert.equal(parseAccount(account).outstandingBalance, '20.00')
  assert.throws(() => parseAccount({ ...account, outstandingBalance: -1 }))
  assert.throws(() => parseAccount({ ...account, outstandingBalance: 21 }))
  assert.equal(
    parseAccount({
      ...account,
      outstandingBalance: 0,
      totalCredit: 0,
      totalPaid: 0,
      lastMovementAt: null,
    }).outstandingBalance,
    '0.00',
  )
  const movement = {
    id: 1,
    customerId: 1,
    saleId: null,
    type: 'PAYMENT',
    amount: 10,
    paymentMethod: 'YAPE',
    note: null,
    createdBy: 1,
    createdByName: 'Admin',
    createdAt: '2026-10-25T12:00:00Z',
  }
  assert.equal(
    parseAccountMovements({ items: [movement], total: 1, page: 0, size: 20 })
      .items[0]?.amount,
    10,
  )
  assert.throws(() =>
    parseAccountMovements({
      items: [{ ...movement, paymentMethod: 'CREDIT' }],
      total: 1,
      page: 0,
      size: 20,
    }),
  )
})
test('acumulados financieros conservan centimos fuera de Number seguro', () => {
  const account = parseAccount({
    customerId: 1,
    customerName: 'María',
    totalCredit: '9999999999999999.99',
    totalPaid: '9999999999999999.49',
    outstandingBalance: '0.50',
    lastMovementAt: null,
  })
  assert.equal(account.outstandingBalance, '0.50')
  assert.equal(formatAccountMoney('0.00'), 'S/ 0.00')
  assert.deepEqual(
    validatePayment('0.50', 'YAPE', '', account.outstandingBalance),
    {},
  )
})
test('intento de pago se restaura por actor y cliente hasta confirmar', () => {
  const data = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  })
  const intent = {
    requestId: '12a45678-1234-1234-1234-123456789abc',
    amount: '20.00',
    paymentMethod: 'CASH' as const,
    note: null,
  }
  savePaymentIntent(1, 2, intent)
  assert.deepEqual(readPaymentIntent(1, 2), intent)
  assert.equal(readPaymentIntent(2, 2), null)
  assert.equal(readPaymentIntent(1, 3), null)
  clearPaymentIntent(1, 2)
  assert.equal(readPaymentIntent(1, 2), null)
})
import { parseCustomerPurchases } from '../src/features/customers/purchases.ts'
import {
  customerBody,
  validateCustomer,
} from '../src/features/customers/validation.ts'
import {
  parseCustomer,
  parseCustomers,
} from '../src/features/customers/types.ts'

const customerValues = {
  name: '  María   Quispe ',
  documentType: 'DNI',
  documentNumber: '12 345678',
  phone: '999 888 777',
  email: '',
  address: '',
  notes: '',
}
test('clientes requieren solo nombre y normalizan documento y contacto', () => {
  assert.deepEqual(validateCustomer(customerValues), {})
  assert.deepEqual(customerBody(customerValues), {
    name: 'María Quispe',
    documentType: 'DNI',
    documentNumber: '12345678',
    phone: '999888777',
    email: null,
    address: null,
    notes: null,
  })
  assert.equal(
    customerBody({
      ...customerValues,
      documentType: '',
      documentNumber: 'ab 123',
    }).documentType,
    'OTHER',
  )
  assert.deepEqual(
    validateCustomer({
      ...customerValues,
      documentType: '',
      documentNumber: '',
      phone: '',
    }),
    {},
  )
})
test('clientes validan documentos manuales, correo y límites', () => {
  for (const invalid of [
    { name: ' ' },
    { documentNumber: '123' },
    { documentType: 'RUC', documentNumber: 'abcdefghijk' },
    { documentType: 'CE', documentNumber: '<script>' },
    { email: 'sin-correo' },
    { phone: 'letras' },
    { notes: 'x'.repeat(1001) },
    { address: 'x'.repeat(241) },
  ])
    assert.ok(
      Object.keys(validateCustomer({ ...customerValues, ...invalid })).length,
    )
})
test('contrato de clientes rechaza respuestas inválidas y descarta campos internos', () => {
  const raw = {
    id: 1,
    name: 'María',
    documentType: null,
    documentNumber: null,
    phone: null,
    email: null,
    address: null,
    notes: null,
    active: true,
    createdAt: '2026-10-25T12:00:00Z',
    updatedAt: '2026-10-25T12:00:00Z',
    secret: 'discarded',
  }
  assert.equal('secret' in parseCustomer(raw), false)
  assert.throws(() => parseCustomer({ ...raw, active: 'true' }))
  assert.throws(() => parseCustomer({ ...raw, documentType: 'PASSPORT' }))
  assert.throws(() => parseCustomer({ ...raw, createdAt: 'ayer' }))
  assert.throws(() =>
    parseCustomers({ items: [raw], total: -1, page: 0, size: 20 }),
  )
  assert.equal(
    parseCustomers({ items: [raw], total: 1, page: 0, size: 20 }).items.length,
    1,
  )
})
import { changeQuantity, cartTotal } from '../src/features/sales/cartState.ts'
import {
  parseSale,
  parseSaleSummary,
  payments,
} from '../src/features/sales/types.ts'
import type { Product } from '../src/features/products/types.ts'

test('venta distingue cliente opcional y limita su respuesta a datos básicos', () => {
  const receipt = {
    id: 1,
    total: 3.5,
    paymentMethod: 'YAPE',
    createdBy: 1,
    createdAt: '2026-10-25T12:00:00Z',
    items: [],
  }
  assert.equal(parseSale(receipt).customer, null)
  assert.equal(parseSale({ ...receipt, customer: null }).customer, null)
  const customer = {
    id: 12,
    name: 'María',
    documentType: 'DNI',
    documentNumber: '12345678',
    notes: 'privado',
  }
  assert.deepEqual(parseSale({ ...receipt, customer }).customer, {
    id: 12,
    name: 'María',
    documentType: 'DNI',
    documentNumber: '12345678',
  })
  assert.throws(() =>
    parseSale({ ...receipt, customer: { ...customer, id: -1 } }),
  )
  assert.throws(() =>
    parseSale({ ...receipt, customer: { ...customer, documentType: 'FAKE' } }),
  )
})

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
test('historial de compras valida paginación y permite clientes sin compras', () => {
  assert.deepEqual(
    parseCustomerPurchases({ items: [], total: 0, page: 0, size: 10 }).items,
    [],
  )
  const purchase = {
    id: 3,
    total: 7,
    paymentMethod: 'YAPE',
    createdAt: '2026-10-25T12:00:00Z',
    items: ['innecesarios'],
  }
  const result = parseCustomerPurchases({
    items: [purchase],
    total: 1,
    page: 0,
    size: 10,
  })
  assert.equal(result.items[0]?.total, 7)
  assert.equal('items' in result.items[0]!, false)
  for (const invalid of [
    { total: -1 },
    { size: 0 },
    { page: 0.5 },
    { items: [{ ...purchase, paymentMethod: 'CARD' }] },
    { items: [{ ...purchase, createdAt: 'ayer' }] },
  ])
    assert.throws(() =>
      parseCustomerPurchases({
        items: [purchase],
        total: 1,
        page: 0,
        size: 10,
        ...invalid,
      }),
    )
})
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
