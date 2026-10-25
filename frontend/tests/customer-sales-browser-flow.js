export default async (page) => {
  const base = 'http://127.0.0.1:5173'
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
  const email = `association-${unique}@example.invalid`
  const employeeEmail = `association-employee-${unique}@example.invalid`
  const setup = await page.request.get(`${base}/api/auth/setup`)
  check(
    (await setup.json()).available === true,
    'Usar exclusivamente un esquema temporal vacío',
  )
  check(
    (
      await page.request.post(`${base}/api/auth/register`, {
        data: { name: 'Admin Prueba', email, password },
      })
    ).status() === 201,
    'Setup aislado',
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
  check(
    (
      await page.request.post(`${base}/api/products`, {
        headers,
        data: {
          name: 'Inca Kola 500 ml',
          sku: 'IK500',
          salePrice: 3.5,
          initialStock: 50,
          minimumStock: 2,
          active: true,
        },
      })
    ).status() === 201,
    'Producto temporal real',
  )
  const empty = await page.request.post(`${base}/api/customers`, {
    headers,
    data: { name: 'Juan Pérez' },
  })
  const emptyId = (await empty.json()).id
  await page.setViewportSize(sizes[2])
  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  await page
    .getByRole('button', { name: '+ Nuevo cliente', exact: true })
    .click()
  await page.getByLabel('Nombre', { exact: true }).fill('María Quispe')
  await page.getByLabel('Tipo de documento (opcional)').selectOption('DNI')
  await page.getByLabel('Número de documento (opcional)').fill('12345678')
  await page
    .getByRole('button', { name: 'Guardar cliente', exact: true })
    .click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const listed = await page.request.get(
    `${base}/api/customers?search=12345678`,
    { headers },
  )
  const mariaId = (await listed.json()).items[0].id
  async function pos() {
    await page.getByRole('link', { name: 'Ventas', exact: true }).click()
    await page
      .getByRole('button', { name: 'Agregar Inca Kola 500 ml', exact: true })
      .waitFor()
  }
  async function add() {
    await page
      .getByRole('button', { name: 'Agregar Inca Kola 500 ml', exact: true })
      .click()
  }
  async function choose(term) {
    await page.getByRole('button', { name: /^Seleccionar cliente:/ }).click()
    await page.getByLabel('Buscar cliente por nombre o documento').fill(term)
    await page
      .getByRole('button', { name: /María Quispe DNI 12345678/ })
      .waitFor()
  }
  async function sale() {
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/sales') && r.request().method() === 'POST',
    )
    await page
      .getByRole('button', { name: 'Registrar venta', exact: true })
      .click()
    const result = await response
    check(result.status() === 201, 'Venta confirmada por backend')
    await page.getByRole('dialog', { name: 'Venta registrada' }).waitFor()
    const receipt = await result.json()
    await page.getByRole('button', { name: 'Nueva venta', exact: true }).click()
    return receipt
  }
  async function mariaDetail() {
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    await page.getByLabel('Buscar clientes').fill('12345678')
    await page
      .getByRole('row')
      .filter({
        has: page.getByRole('rowheader', { name: 'María Quispe', exact: true }),
      })
      .getByRole('button', { name: 'Ver', exact: true })
      .click()
    await page
      .getByRole('heading', { name: 'Historial de compras', exact: true })
      .waitFor()
  }
  await pos()
  await add()
  check(
    await page
      .getByRole('button', {
        name: 'Seleccionar cliente: Público general',
        exact: true,
      })
      .isVisible(),
    'Público general por defecto',
  )
  await choose('12345678')
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`selector ${size.width}`)
  }
  await page.setViewportSize(sizes[2])
  await page.getByRole('button', { name: /María Quispe DNI 12345678/ }).click()
  check(
    (await page.locator('.cart-lines > li').count()) === 1,
    'Seleccionar conserva carrito',
  )
  await page.getByRole('radio', { name: 'Yape', exact: true }).check()
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`POS asociado ${size.width}`)
  }
  await page.setViewportSize(sizes[2])
  let committed
  let intent
  await page.route('**/api/sales', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    intent = route.request().postDataJSON()
    const response = await route.fetch()
    check(
      response.status() === 201,
      'La venta real se confirma antes de perder su respuesta',
    )
    committed = await response.json()
    await route.abort('failed')
  })
  await page
    .getByRole('button', { name: 'Registrar venta', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Comprobar y reintentar', exact: true })
    .waitFor()
  check(
    await page
      .getByRole('button', {
        name: 'Seleccionar cliente: María Quispe',
        exact: true,
      })
      .isDisabled(),
    'Resultado incierto bloquea el cliente',
  )
  check(
    await page
      .getByRole('button', { name: '+ Nuevo cliente', exact: true })
      .isDisabled(),
    'Resultado incierto bloquea creación',
  )
  await page.unroute('**/api/sales')
  const retriedResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/sales') && r.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Comprobar y reintentar', exact: true })
    .click()
  const retried = await retriedResponse
  check(retried.status() === 201, 'Reintento correcto')
  const receipt = await retried.json()
  check(
    receipt.id === committed.id &&
      receipt.customer.id === mariaId &&
      receipt.total === 3.5,
    'Reintento devuelve la misma venta asociada',
  )
  const retryIntent = retried.request().postDataJSON()
  check(
    retryIntent.requestId === intent.requestId &&
      retryIntent.customerId === intent.customerId,
    'Referencia y cliente estables',
  )
  await page.getByRole('button', { name: 'Nueva venta', exact: true }).click()
  await mariaDetail()
  await page
    .getByRole('link', { name: `Ver venta ${receipt.id}`, exact: true })
    .waitFor()
  const history = page.locator('.customer-purchases')
  check(
    await history.getByText('Yape', { exact: true }).isVisible(),
    'Medio real en historial',
  )
  check(
    await history.getByText(/3[,.]50/).isVisible(),
    'Monto real en historial',
  )
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`historial ${size.width}`)
  }
  await page.screenshot({
    path: 'docs/screenshots/cliente-compras-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize(sizes[0])
  await page.screenshot({
    path: 'docs/screenshots/cliente-compras-mobile.png',
    fullPage: true,
  })
  await page
    .getByRole('link', { name: `Ver venta ${receipt.id}`, exact: true })
    .click()
  await page
    .getByRole('dialog', {
      name: `Detalle de venta #${receipt.id}`,
      exact: true,
    })
    .waitFor()
  check(
    await page
      .getByRole('dialog')
      .getByText('María Quispe', { exact: true })
      .isVisible(),
    'Detalle de venta conserva cliente',
  )
  await page
    .getByRole('button', { name: 'Cerrar formulario', exact: true })
    .click()
  await page.setViewportSize(sizes[2])
  await page.getByRole('link', { name: 'Nueva venta', exact: true }).click()
  await add()
  const publicSale = await sale()
  check(publicSale.customer === null, 'Venta sin cliente real')
  const mariaPurchases = await page.request.get(
    `${base}/api/customers/${mariaId}/sales`,
    { headers },
  )
  check(
    (await mariaPurchases.json()).total === 1,
    'Público general no aparece en María',
  )
  await add()
  await page
    .getByRole('button', { name: '+ Nuevo cliente', exact: true })
    .click()
  await page.getByLabel('Nombre', { exact: true }).fill('Rosa Prueba')
  await page
    .getByRole('button', { name: 'Guardar cliente', exact: true })
    .click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  check(
    await page
      .getByRole('button', {
        name: 'Seleccionar cliente: Rosa Prueba',
        exact: true,
      })
      .isVisible(),
    'Alta rápida selecciona automáticamente',
  )
  check(
    (await page.locator('.cart-lines > li').count()) === 1,
    'Alta rápida conserva carrito',
  )
  const rosaSale = await sale()
  check(rosaSale.customer.name === 'Rosa Prueba', 'Venta con alta rápida real')
  await login(employeeEmail)
  await pos()
  await add()
  await choose('María')
  await page.getByRole('button', { name: /María Quispe DNI 12345678/ }).click()
  await page
    .getByRole('button', {
      name: 'Seleccionar cliente: María Quispe',
      exact: true,
    })
    .click()
  await page
    .getByRole('button', { name: 'Público general', exact: true })
    .click()
  check(
    (await page.locator('.cart-lines > li').count()) === 1,
    'Volver a público general conserva carrito',
  )
  await choose('12345678')
  await page.getByRole('button', { name: /María Quispe DNI 12345678/ }).click()
  await page.getByRole('radio', { name: 'Yape', exact: true }).check()
  const employeeSale = await sale()
  check(employeeSale.customer.id === mariaId, 'Empleado puede asociar cliente')
  await mariaDetail()
  await page
    .getByRole('link', { name: `Ver venta ${employeeSale.id}`, exact: true })
    .waitFor()
  check(
    (await page.locator('.customer-purchases li').count()) === 2,
    'Empleado consulta historial real compartido del negocio',
  )
  await audit('historial empleado')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByLabel('Buscar clientes').fill('Juan Pérez')
  await page
    .getByRole('row')
    .filter({
      has: page.getByRole('rowheader', { name: 'Juan Pérez', exact: true }),
    })
    .getByRole('button', { name: 'Ver', exact: true })
    .click()
  await page
    .getByText('Este cliente todavía no tiene compras registradas.', {
      exact: true,
    })
    .waitFor()
  await audit('cliente sin compras')
  check(
    (
      await page.request.get(`${base}/api/customers/${emptyId}/sales`, {
        headers,
      })
    ).ok(),
    'Cliente vacío tiene historial consultable',
  )
  check(
    await page.evaluate(
      () =>
        localStorage.length === 0 &&
        sessionStorage.length === 0 &&
        document.cookie === '',
    ),
    'Sin persistencia privada en navegador',
  )
  check(
    !runtimeErrors.length,
    `Errores inesperados: ${runtimeErrors.join(', ')}`,
  )
  return {
    results,
    flows:
      'ADMIN y EMPLOYEE; cliente activo; Público general; búsqueda por nombre/documento; alta rápida; carrito conservado; historial real; vacío; reintento tras respuesta perdida sin duplicar',
    runtimeErrors: runtimeErrors.length,
  }
}
