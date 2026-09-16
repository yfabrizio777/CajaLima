export default async (page) => {
  const base = 'http://127.0.0.1:5174'
  const results = []
  const runtimeErrors = []
  page.on('pageerror', (error) => runtimeErrors.push(error.name))
  const check = (value, message) => {
    if (!value) throw new Error(message)
  }
  const sizes = [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
  ]
  async function audit(label) {
    await page.evaluate(() => window.scrollTo(0, 0))
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
  const email = `sales-${unique}@example.invalid`
  const employeeEmail = `employee-${unique}@example.invalid`
  const registration = await page.request.post(`${base}/api/auth/register`, {
    data: { name: 'Fabrizio Prueba', email, password },
  })
  check(registration.status() === 201, 'Requiere esquema aislado vacío')
  async function login(address) {
    await page.goto(`${base}/login`)
    await page.getByLabel('Correo', { exact: true }).fill(address)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    const response = page.waitForResponse((r) =>
      r.url().endsWith('/api/auth/login'),
    )
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    const loginResponse = await response
    check(loginResponse.ok(), 'Login real')
    await page.waitForURL('**/app')
    return (await loginResponse.json()).token
  }
  const admin = await login(email)
  const headers = { Authorization: `Bearer ${admin}` }
  const employee = await page.request.post(`${base}/api/users`, {
    headers,
    data: { name: 'Colaborador Prueba', email: employeeEmail, password },
  })
  check(employee.status() === 201, 'EMPLOYEE creado por ADMIN')
  async function product(name, sku, salePrice, initialStock) {
    const response = await page.request.post(`${base}/api/products`, {
      headers,
      data: {
        name,
        sku,
        salePrice,
        initialStock,
        minimumStock: 2,
        active: true,
      },
    })
    check(response.status() === 201, 'Producto temporal real')
    return (await response.json()).id
  }
  const kola = await product('Inca Kola 500 ml', 'IK500', '3.50', 24)
  const water = await product('Agua San Luis 625 ml', 'AS625', '2.00', 10)
  await page.setViewportSize(sizes[2])
  await page.getByRole('link', { name: 'Ventas', exact: true }).click()
  await page
    .getByRole('button', { name: 'Agregar Inca Kola 500 ml', exact: true })
    .waitFor()
  check(
    await page
      .getByRole('button', { name: 'Registrar venta', exact: true })
      .isDisabled(),
    'Carrito vacío no vende',
  )
  await page
    .getByRole('button', { name: 'Agregar Inca Kola 500 ml', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Eliminar Inca Kola 500 ml', exact: true })
    .click()
  check(
    await page
      .getByRole('button', { name: 'Registrar venta', exact: true })
      .isDisabled(),
    'Eliminar vacía carrito',
  )
  await page.getByLabel('Buscar producto', { exact: true }).fill('IK500')
  await page
    .getByRole('button', { name: 'Agregar Agua San Luis 625 ml', exact: true })
    .waitFor({ state: 'hidden' })
  await page
    .getByRole('button', { name: 'Agregar Inca Kola 500 ml', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Aumentar Inca Kola 500 ml', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Aumentar Inca Kola 500 ml', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Disminuir Inca Kola 500 ml', exact: true })
    .click()
  await page.getByLabel('Buscar producto', { exact: true }).fill('Agua')
  await page
    .getByRole('button', { name: 'Agregar Agua San Luis 625 ml', exact: true })
    .click()
  await page
    .locator('#cart .sale-total')
    .getByText('S/ 9.00', { exact: true })
    .waitFor()
  await page.getByRole('radio', { name: 'Yape', exact: true }).check()
  await page.getByLabel('Buscar producto', { exact: true }).fill('')
  await page
    .getByRole('button', { name: 'Agregar Inca Kola 500 ml', exact: true })
    .waitFor()
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`POS carrito y pago ${size.width}`)
    if (size.width === 375)
      await page.screenshot({
        path: 'docs/screenshots/pos-mobile.png',
        fullPage: true,
      })
  }
  await page.screenshot({
    path: 'docs/screenshots/pos-desktop.png',
    fullPage: true,
  })
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/sales') && r.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Registrar venta', exact: true })
    .click()
  const saved = await response
  check(saved.status() === 201, 'Venta ADMIN creada')
  const sale = await saved.json()
  check(
    sale.total === 9 && sale.paymentMethod === 'YAPE',
    'Precio y método reales',
  )
  await page.getByRole('dialog', { name: 'Venta registrada' }).waitFor()
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`confirmación ${size.width}`)
  }
  await page.screenshot({
    path: 'docs/screenshots/venta-confirmada.png',
    fullPage: false,
  })
  const retry = await page.request.post(`${base}/api/sales`, {
    headers,
    data: saved.request().postDataJSON(),
  })
  check(
    retry.status() === 201 && (await retry.json()).id === sale.id,
    'Reintento no duplica',
  )
  for (const [id, stock] of [
    [kola, 22],
    [water, 9],
  ]) {
    const result = await page.request.get(`${base}/api/products/${id}`, {
      headers,
    })
    check(
      (await result.json()).stock === stock,
      'Stock reducido exactamente una vez',
    )
  }
  await page.getByRole('button', { name: 'Nueva venta', exact: true }).click()
  await page.getByRole('link', { name: 'Inicio', exact: true }).click()
  await page
    .locator('.metric-card')
    .filter({
      has: page.getByRole('heading', { name: 'Ventas de hoy', exact: true }),
    })
    .getByText('S/ 9.00', { exact: true })
    .waitFor()
  await page
    .locator('.metric-card')
    .filter({
      has: page.getByRole('heading', {
        name: 'Ventas registradas',
        exact: true,
      }),
    })
    .getByText('1', { exact: true })
    .waitFor()
  await audit('dashboard real')
  await page.getByRole('link', { name: 'Ventas', exact: true }).click()
  await page.getByRole('link', { name: 'Ver ventas', exact: true }).click()
  await page
    .getByRole('button', {
      name: `Ver detalle de venta #${sale.id}`,
      exact: true,
    })
    .click()
  await page.getByRole('dialog').getByText('Yape', { exact: true }).waitFor()
  await audit('historial y detalle')
  await page
    .getByRole('button', { name: 'Cerrar formulario', exact: true })
    .click()
  await page.getByRole('link', { name: 'Nueva venta', exact: true }).click()
  await page
    .getByRole('button', { name: 'Agregar Inca Kola 500 ml', exact: true })
    .click()
  const adjust = await page.request.post(
    `${base}/api/products/${kola}/stock-adjustments`,
    { headers, data: { newStock: 0, reason: 'Prueba de cambio concurrente' } },
  )
  check(adjust.ok(), 'Cambio de stock externo controlado')
  await page
    .getByRole('button', { name: 'Registrar venta', exact: true })
    .click()
  await page.getByRole('alert').filter({ hasText: 'stock cambió' }).waitFor()
  await page.getByRole('button', { name: 'Vaciar', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await login(employeeEmail)
  await page.getByRole('link', { name: 'Ventas', exact: true }).click()
  await page.setViewportSize(sizes[0])
  await page
    .getByRole('button', { name: 'Agregar Agua San Luis 625 ml', exact: true })
    .click()
  await page.getByRole('link', { name: /Ver tu venta/ }).click()
  await page.getByRole('radio', { name: 'Efectivo', exact: true }).check()
  await audit('EMPLOYEE móvil efectivo')
  await page
    .getByRole('button', { name: 'Registrar venta', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Venta registrada' })
    .getByText('S/ 2.00', { exact: true })
    .first()
    .waitFor()
  const summary = await page.request.get(`${base}/api/sales/summary`, {
    headers,
  })
  const summaryData = await summary.json()
  check(
    summaryData.total === 11 && summaryData.count === 2,
    'Dos ventas reales suman S/ 11.00',
  )
  check(
    await page.evaluate(
      () =>
        localStorage.length === 0 &&
        sessionStorage.length === 0 &&
        document.cookie === '',
    ),
    'Sin persistencia de JWT',
  )
  check(runtimeErrors.length === 0, 'Sin errores JavaScript')
  return {
    results,
    total: summaryData.total,
    sales: summaryData.count,
    runtimeErrors: 0,
    screenshots: 3,
    flows:
      'ADMIN Yape, EMPLOYEE efectivo, carrito, búsqueda, reintento, stock insuficiente, historial y dashboard correctos',
  }
}
