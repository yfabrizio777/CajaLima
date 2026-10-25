export default async (page) => {
  const base = 'http://127.0.0.1:5173',
    results = [],
    errors = []
  const check = (ok, message) => {
    if (!ok) throw new Error(message)
  }
  page.on('pageerror', (e) => errors.push(e.name))
  const sizes = [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
  ]
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
      `Overflow: ${label}`,
    )
    results.push(`${label}: axe 0, sin overflow`)
  }
  async function sizesAudit(label) {
    for (const size of sizes) {
      await page.setViewportSize(size)
      await audit(`${label} ${size.width}`)
    }
  }
  await page.goto(`${base}/login`)
  const unique = await page.evaluate(() => crypto.randomUUID()),
    password = await page.evaluate(() => crypto.randomUUID())
  const email = `spending-${unique}@example.invalid`,
    employeeEmail = `spending-employee-${unique}@example.invalid`
  check(
    (await (await page.request.get(`${base}/api/auth/setup`)).json()).available,
    'Requiere esquema nuevo y exclusivo',
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
  let token = await login(email)
  const headers = { Authorization: `Bearer ${token}` }
  check(
    (
      await page.request.post(`${base}/api/users`, {
        headers,
        data: { name: 'Colaborador Prueba', email: employeeEmail, password },
      })
    ).status() === 201,
    'Empleado temporal',
  )
  const created = await page.request.post(`${base}/api/products`, {
    headers,
    data: {
      name: 'Arroz de prueba',
      sku: null,
      salePrice: '5.00',
      costPrice: '2.00',
      initialStock: 5,
      minimumStock: 0,
      active: true,
    },
  })
  check(created.status() === 201, 'Producto temporal')
  const product = (await created.json()).id
  async function expenses() {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page
      .locator('.desktop-sidebar')
      .getByRole('link', { name: 'Gastos', exact: true })
      .click()
    await page.getByRole('heading', { name: 'Gastos', exact: true }).waitFor()
  }
  async function purchases() {
    await page
      .getByRole('navigation', { name: 'Gastos y compras' })
      .getByRole('link', { name: 'Compras', exact: true })
      .click()
    await page.getByRole('heading', { name: 'Compras', exact: true }).waitFor()
  }
  async function openForm(kind) {
    await page
      .getByRole('button', {
        name: kind === 'expenses' ? '+ Registrar gasto' : '+ Registrar compra',
        exact: true,
      })
      .click()
    await page.getByRole('dialog').waitFor()
  }
  let requestId = '',
    lost = false
  async function loseResponse(kind) {
    lost = false
    await page.route(`**/api/${kind}`, async (route) => {
      if (route.request().method() !== 'POST' || lost) {
        await route.continue()
        return
      }
      requestId = route.request().postDataJSON().requestId
      const committed = await route.fetch()
      check(
        committed.status() === 201,
        'Registro confirmado antes de perder respuesta',
      )
      lost = true
      await route.abort('failed')
    })
  }
  async function recover(kind, address) {
    await page
      .getByText('El resultado está pendiente de confirmar.', { exact: false })
      .waitFor()
    check(lost, 'Respuesta perdida después de commit')
    await page.unroute(`**/api/${kind}`)
    await page.reload()
    token = await login(address)
    await expenses()
    if (kind === 'purchases') await purchases()
    await page
      .getByRole('button', {
        name: 'Comprobar registro pendiente',
        exact: true,
      })
      .click()
    await page.getByLabel('Descripción', { exact: true }).waitFor()
    check(
      await page.getByLabel('Descripción', { exact: true }).isDisabled(),
      'Datos congelados durante recuperación',
    )
    let injected = false
    await page.route(`**/api/${kind}`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      check(
        route.request().postDataJSON().requestId === requestId,
        'Mismo UUID restaurado',
      )
      if (!injected) {
        injected = true
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: '{}',
        })
        return
      }
      await route.continue()
    })
    await page
      .getByRole('button', { name: 'Comprobar y reintentar', exact: true })
      .click()
    await page
      .getByRole('alert')
      .filter({ hasText: 'No pudimos confirmar' })
      .waitFor()
    check(
      await page.getByLabel('Descripción', { exact: true }).isDisabled(),
      '409 mantiene UUID y datos congelados',
    )
    await page
      .getByRole('button', { name: 'Comprobar y reintentar', exact: true })
      .click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.unroute(`**/api/${kind}`)
    check(
      await page.evaluate(
        () =>
          !Object.keys(sessionStorage).some((k) =>
            k.startsWith('cajalima.spending.'),
          ),
      ),
      'Intento resuelto eliminado',
    )
  }
  for (const role of ['ADMIN', 'EMPLOYEE']) {
    const address = role === 'ADMIN' ? email : employeeEmail
    if (role === 'EMPLOYEE') token = await login(address)
    await expenses()
    if (role === 'ADMIN') {
      await page
        .getByRole('heading', { name: 'Todavía no hay gastos registrados' })
        .waitFor()
      await audit('Gastos vacío')
    }
    await purchases()
    if (role === 'ADMIN')
      await page
        .getByRole('heading', { name: 'Todavía no hay compras registradas' })
        .waitFor()
    await openForm('purchases')
    await page
      .getByRole('button', { name: 'Registrar compra', exact: true })
      .click()
    await page
      .getByText('Escribe una descripción de hasta 160 caracteres.', {
        exact: true,
      })
      .waitFor()
    check(
      await page
        .getByLabel('Descripción', { exact: true })
        .evaluate((el) => el === document.activeElement),
      'Primer error enfocado',
    )
    await page.getByLabel('Descripción', { exact: true }).fill(`Compra ${role}`)
    await page
      .getByLabel('Proveedor (opcional)', { exact: true })
      .fill('Proveedor de prueba')
    await page
      .getByRole('button', { name: 'Agregar Arroz de prueba', exact: true })
      .click()
    await page
      .getByLabel('Cantidad de Arroz de prueba', { exact: true })
      .fill('10')
    await page
      .getByLabel('Costo unitario de Arroz de prueba (S/)', { exact: true })
      .fill('2.50')
    await page
      .getByLabel('¿Cómo pagaste?', { exact: true })
      .selectOption('YAPE')
    check(
      (await page.locator('.purchase-total').innerText()).includes('S/ 25.00'),
      'Total preliminar exacto',
    )
    if (role === 'ADMIN') await sizesAudit('Formulario compra')
    if (role === 'ADMIN') await loseResponse('purchases')
    await page
      .getByRole('button', { name: 'Registrar compra', exact: true })
      .click()
    if (role === 'ADMIN') await recover('purchases', address)
    else await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page
      .locator('.spending-card')
      .filter({ hasText: `Compra ${role}` })
      .waitFor()
    const stock = await (
      await page.request.get(`${base}/api/products/${product}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json()
    check(
      stock.stock === (role === 'ADMIN' ? 15 : 25),
      'Stock incrementado una vez',
    )
    if (role === 'ADMIN') {
      await sizesAudit('Listado compras')
      await page.setViewportSize(sizes[0])
      await page.screenshot({
        path: 'docs/screenshots/compras-mobile.png',
        fullPage: true,
      })
      await page
        .locator('.spending-card')
        .filter({ hasText: 'Compra ADMIN' })
        .getByRole('button', { name: /Ver compra/ })
        .click()
      await page
        .getByRole('heading', { name: 'Productos comprados', exact: true })
        .waitFor()
      await page
        .getByRole('button', { name: 'Editar datos', exact: true })
        .click()
      await page
        .getByLabel('Descripción', { exact: true })
        .fill('Compra ADMIN corregida')
      await page
        .getByRole('button', { name: 'Guardar datos', exact: true })
        .click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
    }
    await page.setViewportSize(sizes[2])
    await page
      .getByRole('navigation', { name: 'Gastos y compras' })
      .getByRole('link', { name: 'Gastos', exact: true })
      .click()
    await openForm('expenses')
    await page
      .getByLabel('Descripción', { exact: true })
      .fill(`Movilidad ${role}`)
    await page
      .getByLabel('Categoría *', { exact: true })
      .selectOption('TRANSPORT')
    await page.getByLabel('Monto (S/)', { exact: true }).fill('-1')
    await page
      .getByRole('button', { name: 'Registrar gasto', exact: true })
      .click()
    await page
      .getByText('Escribe un monto mayor a cero con hasta dos decimales.', {
        exact: true,
      })
      .waitFor()
    await page.getByLabel('Monto (S/)', { exact: true }).fill('12.50')
    await page
      .getByLabel('¿Cómo pagaste?', { exact: true })
      .selectOption('CASH')
    if (role === 'ADMIN') await sizesAudit('Formulario gasto')
    if (role === 'EMPLOYEE') await loseResponse('expenses')
    await page
      .getByRole('button', { name: 'Registrar gasto', exact: true })
      .click()
    if (role === 'EMPLOYEE') await recover('expenses', address)
    else await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page
      .locator('.spending-card')
      .filter({ hasText: `Movilidad ${role}` })
      .waitFor()
    if (role === 'ADMIN') {
      await sizesAudit('Listado gastos')
      await page.screenshot({
        path: 'docs/screenshots/gastos-desktop.png',
        fullPage: true,
      })
    } else {
      await page
        .locator('.spending-card')
        .filter({ hasText: 'Movilidad EMPLOYEE' })
        .getByRole('button', { name: /Ver gasto/ })
        .click()
      await page
        .getByRole('heading', { name: 'Movilidad EMPLOYEE', exact: true })
        .waitFor()
      check(
        (await page
          .getByRole('button', { name: 'Editar datos', exact: true })
          .count()) === 0,
        'Empleado sin edición',
      )
      await page.getByRole('button', { name: 'Listo', exact: true }).click()
    }
    await page.setViewportSize(sizes[2])
    await page
      .locator('.desktop-sidebar')
      .getByRole('link', { name: 'Inicio', exact: true })
      .click()
    await page
      .getByRole('heading', { name: 'Gastos de hoy', exact: true })
      .waitFor()
    const expensesMetric = page.locator('.metric-card').filter({
      has: page.getByRole('heading', { name: 'Gastos de hoy', exact: true }),
    })
    const purchaseMetric = page.locator('.metric-card').filter({
      has: page.getByRole('heading', { name: 'Compras de hoy', exact: true }),
    })
    await expensesMetric
      .getByText(role === 'ADMIN' ? 'S/ 12.50' : 'S/ 25.00', { exact: true })
      .waitFor()
    await purchaseMetric
      .getByText(role === 'ADMIN' ? 'S/ 25.00' : 'S/ 50.00', { exact: true })
      .waitFor()
    if (role === 'EMPLOYEE') {
      await page.setViewportSize(sizes[0])
      await audit('Dashboard empleado')
    }
    results.push(`${role}: compra +10, gasto 12.50, stock y dashboard reales`)
  }
  check(!errors.length, JSON.stringify(errors))
  return { results, runtimeErrors: errors.length, temporaryData: true }
}
