import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDate, formatMoney } from '../src/lib/locale.ts'
import { validate } from '../src/features/auth/validation.ts'
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
