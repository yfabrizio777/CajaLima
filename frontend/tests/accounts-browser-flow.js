export default async (page) => {
  const base = 'http://127.0.0.1:5173'
  const results = []
  const errors = []
  page.on('pageerror', (error) => errors.push(error.name))
  const check = (value, message) => {
    if (!value) throw new Error(message)
  }
  const sizes = [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
  ]
  let auditedPos = false
  async function audit(label) {
    await page.evaluate(() => document.fonts.ready)
    await page.addScriptTag({
      path: 'frontend/node_modules/axe-core/axe.min.js',
    })
    const violations = await page.evaluate(async () =>
      (
        await window.axe.run(document, {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
        })
      ).violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    )
    check(!violations.length, JSON.stringify({ label, violations }))
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow ${label}`,
    )
    results.push(`${label}: axe 0, sin overflow`)
  }
  await page.goto(`${base}/login`)
  const unique = await page.evaluate(() => crypto.randomUUID())
  const password = await page.evaluate(() => crypto.randomUUID())
  const email = `accounts-${unique}@example.invalid`
  const employeeEmail = `accounts-employee-${unique}@example.invalid`
  check(
    (await (await page.request.get(`${base}/api/auth/setup`)).json()).available,
    'Requiere esquema nuevo exclusivo',
  )
  check(
    (
      await page.request.post(`${base}/api/auth/register`, {
        data: { name: 'Admin Prueba', email, password },
      })
    ).status() === 201,
    'Setup temporal',
  )
  async function login(address) {
    await page.goto(`${base}/login`)
    await page.getByLabel('Correo', { exact: true }).fill(address)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    const response = page.waitForResponse((r) =>
      r.url().endsWith('/api/auth/login'),
    )
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    const logged = await response
    check(logged.ok(), 'Login real')
    await page.waitForURL('**/app')
    return (await logged.json()).token
  }
  const admin = await login(email)
  const headers = { Authorization: `Bearer ${admin}` }
  check(
    (
      await page.request.post(`${base}/api/users`, {
        headers,
        data: { name: 'Colaborador Prueba', email: employeeEmail, password },
      })
    ).status() === 201,
    'Empleado temporal',
  )
  const customerResult = await page.request.post(`${base}/api/customers`, {
    headers,
    data: {
      name: 'María Quispe',
      documentType: 'DNI',
      documentNumber: '12345678',
    },
  })
  const customerId = (await customerResult.json()).id
  const productResult = await page.request.post(`${base}/api/products`, {
    headers,
    data: {
      name: 'Producto de prueba',
      sku: 'FIADO30',
      salePrice: 30,
      initialStock: 10,
      minimumStock: 1,
      active: true,
    },
  })
  const productId = (await productResult.json()).id
  await page.setViewportSize(sizes[2])
  async function openCustomer() {
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    await page.getByLabel('Buscar clientes').fill('12345678')
    await page
      .getByRole('row')
      .filter({
        has: page.getByRole('rowheader', { name: 'María Quispe', exact: true }),
      })
      .getByRole('button', { name: 'Ver', exact: true })
      .click()
    await page.locator('.account-balance').waitFor()
  }
  async function balance(amount) {
    await page
      .locator('.account-balance')
      .filter({ hasText: new RegExp(`S/\\s*${amount}\\.00`) })
      .waitFor()
  }
  async function creditSale() {
    await page.getByRole('link', { name: 'Ventas', exact: true }).click()
    await page
      .getByRole('button', { name: 'Agregar Producto de prueba', exact: true })
      .click()
    await page.getByRole('radio', { name: 'Fiado', exact: true }).check()
    await page
      .getByText('Selecciona un cliente para registrar una venta fiada.', {
        exact: true,
      })
      .waitFor()
    check(
      await page
        .getByRole('button', { name: 'Registrar venta', exact: true })
        .isDisabled(),
      'Fiado sin cliente bloqueado',
    )
    await page.getByRole('button', { name: /^Seleccionar cliente:/ }).click()
    await page
      .getByLabel('Buscar cliente por nombre o documento')
      .fill('12345678')
    await page
      .getByRole('button', { name: /María Quispe DNI 12345678/ })
      .click()
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/sales') && r.request().method() === 'POST',
    )
    if (!auditedPos) {
      for (const size of sizes) {
        await page.setViewportSize(size)
        await audit(`POS Fiado ${size.width}`)
      }
      await page.setViewportSize(sizes[2])
      auditedPos = true
    }
    await page
      .getByRole('button', { name: 'Registrar venta', exact: true })
      .click()
    const sold = await response
    check(sold.status() === 201, 'Venta fiada real')
    check((await sold.json()).paymentMethod === 'CREDIT', 'Medio CREDIT')
    await page.getByRole('button', { name: 'Nueva venta', exact: true }).click()
  }
  async function pay(amount, method) {
    await page
      .getByRole('button', { name: 'Registrar pago', exact: true })
      .click()
    await page.getByLabel('Monto (S/)', { exact: true }).fill(amount)
    await page
      .getByRole('dialog', { name: 'Registrar pago', exact: true })
      .getByRole('radio', { name: method, exact: true })
      .check()
    const response = page.waitForResponse((r) =>
      r.url().endsWith(`/customers/${customerId}/payments`),
    )
    await page
      .getByRole('dialog', { name: 'Registrar pago', exact: true })
      .getByRole('button', { name: 'Registrar pago', exact: true })
      .click()
    check((await response).status() === 201, 'Pago real')
    await page
      .getByRole('dialog', { name: 'Registrar pago', exact: true })
      .waitFor({ state: 'hidden' })
  }
  await creditSale()
  check(
    (
      await (
        await page.request.get(`${base}/api/products/${productId}`, { headers })
      ).json()
    ).stock === 9,
    'Stock descontado',
  )
  await openCustomer()
  await balance(30)
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`cuenta ${size.width}`)
  }
  await page.setViewportSize(sizes[2])
  await page
    .getByRole('button', { name: 'Registrar pago', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Registrar pago', exact: true })
    .getByRole('button', { name: 'Registrar pago', exact: true })
    .click()
  await page
    .getByText(
      'Ingresa un monto mayor a cero y que no supere el saldo pendiente.',
      { exact: true },
    )
    .waitFor()
  await page.getByLabel('Monto (S/)', { exact: true }).fill('10')
  await page
    .getByRole('dialog', { name: 'Registrar pago', exact: true })
    .getByRole('radio', { name: 'Yape', exact: true })
    .check()
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`dialog pago ${size.width}`)
  }
  await page.setViewportSize(sizes[2])
  const paid = page.waitForResponse((r) =>
    r.url().endsWith(`/customers/${customerId}/payments`),
  )
  await page
    .getByRole('dialog', { name: 'Registrar pago', exact: true })
    .getByRole('button', { name: 'Registrar pago', exact: true })
    .click()
  check((await paid).status() === 201, 'Pago Yape 10')
  await page
    .getByRole('dialog', { name: 'Registrar pago', exact: true })
    .waitFor({ state: 'hidden' })
  await balance(20)
  await page.screenshot({
    path: 'docs/screenshots/fiados-cuenta-desktop.png',
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Registrar pago', exact: true })
    .click()
  await page.getByLabel('Monto (S/)', { exact: true }).fill('20')
  let committed
  let requestId
  await page.route('**/payments', async (route) => {
    requestId = route.request().postDataJSON().requestId
    const response = await route.fetch()
    check(
      response.status() === 201,
      'Pago total confirmado antes de perder respuesta',
    )
    committed = await response.json()
    await route.abort('failed')
  })
  await page
    .getByRole('dialog', { name: 'Registrar pago', exact: true })
    .getByRole('button', { name: 'Registrar pago', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Comprobar y reintentar', exact: true })
    .waitFor()
  await page.unroute('**/payments')
  await page.reload()
  await login(email)
  await openCustomer()
  await balance(0)
  await page
    .getByRole('button', { name: 'Comprobar pago pendiente', exact: true })
    .click()
  check(
    (await page.getByLabel('Monto (S/)', { exact: true }).inputValue()) ===
      '20',
    'Recarga restaura intento',
  )
  const retryResponse = page.waitForResponse((r) =>
    r.url().endsWith(`/customers/${customerId}/payments`),
  )
  await page
    .getByRole('button', { name: 'Comprobar y reintentar', exact: true })
    .click()
  const retry = await retryResponse
  check(
    retry.status() === 201 &&
      (await retry.json()).id === committed.id &&
      retry.request().postDataJSON().requestId === requestId,
    'Reintento restaurado no duplica pago total',
  )
  await page
    .getByRole('dialog', { name: 'Registrar pago', exact: true })
    .waitFor({ state: 'hidden' })
  await balance(0)
  await page.getByText('No tiene saldo pendiente.', { exact: true }).waitFor()
  check(
    (await page.locator('.account-movements li').count()) === 3,
    'Tres movimientos auditables',
  )
  check(
    await page.getByText('Pago Yape', { exact: true }).isVisible(),
    'Medio y signo de pago',
  )
  const overpay = await page.request.post(
    `${base}/api/customers/${customerId}/payments`,
    {
      headers,
      data: {
        requestId: await page.evaluate(() => crypto.randomUUID()),
        amount: 1,
        paymentMethod: 'CASH',
      },
    },
  )
  check(overpay.status() === 409, 'Sin saldo a favor')
  await page.setViewportSize(sizes[0])
  await audit('saldo cero móvil')
  await page.screenshot({
    path: 'docs/screenshots/fiados-cuenta-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize(sizes[2])
  const employee = await login(employeeEmail)
  await creditSale()
  await openCustomer()
  await balance(30)
  await pay('10', 'Yape')
  await balance(20)
  await pay('20', 'Efectivo')
  await balance(0)
  check(
    (await page.locator('.account-movements li').count()) === 6,
    'Empleado consulta todos los movimientos del negocio',
  )
  await audit('cuenta empleado')
  const employeeActor = (
    await (
      await page.request.get(`${base}/api/auth/me`, {
        headers: { Authorization: `Bearer ${employee}` },
      })
    ).json()
  ).id
  check(
    (
      await page.request.patch(`${base}/api/customers/${customerId}/status`, {
        headers,
        data: { active: false },
      })
    ).ok(),
    'Inactivar ficha temporal',
  )
  await page.evaluate(
    ({ actor, id }) =>
      sessionStorage.setItem(
        `cajalima.payment.${actor}.${id}`,
        JSON.stringify({
          requestId: crypto.randomUUID(),
          amount: '1',
          paymentMethod: 'CASH',
          note: null,
        }),
      ),
    { actor: employeeActor, id: customerId },
  )
  await page.reload()
  await login(employeeEmail)
  await openCustomer()
  await page
    .getByRole('button', { name: 'Comprobar pago pendiente', exact: true })
    .click()
  const rejected = page.waitForResponse((r) =>
    r.url().endsWith(`/customers/${customerId}/payments`),
  )
  await page
    .getByRole('button', { name: 'Comprobar y reintentar', exact: true })
    .click()
  check(
    (await rejected).status() === 409,
    'Rechazo definitivo de cliente inactivo',
  )
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await balance(0)
  check(
    (await page
      .getByRole('button', { name: 'Comprobar pago pendiente', exact: true })
      .count()) === 0,
    'Sin intento fantasma tras rechazo definitivo',
  )
  check(
    (await page.locator('.account-payment').allTextContents()).every((text) =>
      text.trim().startsWith('- '),
    ),
    'Cada pago muestra signo menos explícito',
  )
  check(
    (
      await (
        await page.request.get(`${base}/api/products/${productId}`, { headers })
      ).json()
    ).stock === 8,
    'Stock correcto tras ambos roles',
  )
  check(
    await page.evaluate(
      () =>
        localStorage.length === 0 &&
        sessionStorage.length === 0 &&
        document.cookie === '',
    ),
    'Intentos resueltos limpiados; JWT no persistido',
  )
  check(!errors.length, `Errores inesperados: ${errors.join(', ')}`)
  return {
    results,
    flows:
      'ADMIN y EMPLOYEE: fiado30, pago Yape10 y efectivo20, saldo30/20/0, movimientos, stock, sobrepago rechazado, fiado requiere cliente; pago total con respuesta perdida y recarga conserva UUID sin duplicación',
    runtimeErrors: errors.length,
  }
}
