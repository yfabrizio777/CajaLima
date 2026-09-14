export default async (page) => {
  const base = 'http://127.0.0.1:5174'
  const results = []
  const runtimeErrors = []
  page.on('pageerror', (e) => runtimeErrors.push(e.name))
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
  const email = `products-${unique}@example.invalid`
  const employeeEmail = `employee-${unique}@example.invalid`
  const registered = await page.request.post(`${base}/api/auth/register`, {
    data: { name: 'Fabrizio Prueba', email, password },
  })
  check(registered.status() === 201, 'Requiere esquema de prueba vacío')
  async function signIn(address) {
    await page.goto(`${base}/login`)
    await page.getByLabel('Correo', { exact: true }).fill(address)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    const response = page.waitForResponse((r) =>
      r.url().endsWith('/api/auth/login'),
    )
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    const login = await response
    check(login.ok(), 'Login real')
    await page.waitForURL('**/app')
    return (await login.json()).token
  }
  const token = await signIn(email)
  const createdEmployee = await page.request.post(`${base}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Colaborador Prueba', email: employeeEmail, password },
  })
  check(createdEmployee.status() === 201, 'Creación EMPLOYEE real')
  await page.setViewportSize(sizes[2])
  await page.getByRole('link', { name: 'Productos', exact: true }).click()
  await page
    .getByRole('heading', { name: 'Agrega tu primer producto' })
    .waitFor()
  await audit('empty ADMIN')
  async function newProduct(name, sku, price, stock) {
    await page
      .getByRole('button', { name: '+ Nuevo producto', exact: true })
      .click()
    await page.getByRole('button', { name: 'Guardar producto' }).click()
    check(
      (await page.locator('#name').getAttribute('aria-invalid')) === 'true',
      'Validación producto',
    )
    await page.getByLabel('Nombre', { exact: true }).fill(name)
    await page.getByLabel('Código / SKU (opcional)', { exact: true }).fill(sku)
    await page.getByLabel('Precio de venta (S/)', { exact: true }).fill(price)
    await page.getByLabel('Stock inicial', { exact: true }).fill(stock)
    await page
      .getByLabel('Avisarme cuando queden...', { exact: true })
      .fill('5')
    for (const size of sizes) {
      await page.setViewportSize(size)
      await audit(`formulario ${size.width}`)
    }
    if (sku === 'IK500')
      await page.screenshot({
        path: 'docs/screenshots/producto-nuevo.png',
        fullPage: true,
      })
    await page.getByRole('button', { name: 'Guardar producto' }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.getByRole('row').filter({ hasText: name }).waitFor()
  }
  await newProduct('Inca Kola 500 ml', 'IK500', '3.50', '24')
  await newProduct('Agua San Luis 625 ml', 'AS625', '2.00', '8')
  await page.getByLabel('Buscar productos').fill('ik500')
  await page.getByText('1 producto', { exact: true }).waitFor()
  check(
    (await page.getByRole('row').filter({ hasText: 'Inca Kola' }).count()) ===
      1,
    'Búsqueda SKU',
  )
  await page.getByLabel('Buscar productos').fill('Agua')
  await page.getByRole('row').filter({ hasText: 'Agua San Luis' }).waitFor()
  await page
    .getByRole('row')
    .filter({ hasText: 'Agua San Luis' })
    .getByRole('button', { name: 'Ajustar stock' })
    .click()
  await page.getByLabel('Nuevo stock', { exact: true }).fill('3')
  await page.getByLabel('Motivo', { exact: true }).fill('Conteo físico')
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`ajuste ${size.width}`)
  }
  await page.getByRole('button', { name: 'Confirmar ajuste' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const row = page.getByRole('row').filter({ hasText: 'Agua San Luis' })
  await row.getByText('Poco stock', { exact: true }).waitFor()
  await row.getByRole('button', { name: 'Editar', exact: true }).click()
  await page.getByLabel('Precio de venta (S/)', { exact: true }).fill('2.50')
  check(
    (await page.getByLabel('Stock inicial', { exact: true }).count()) === 0,
    'Edición separada de stock',
  )
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await row.getByText('S/ 2.50', { exact: true }).waitFor()
  await row.getByRole('button', { name: 'Desactivar', exact: true }).click()
  await row.getByText('Inactivo', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Inactivos', exact: true }).click()
  await row.getByRole('button', { name: 'Reactivar', exact: true }).click()
  await page
    .getByRole('heading', { name: 'No encontramos productos' })
    .waitFor()
  await page.getByRole('button', { name: 'Todos', exact: true }).click()
  await page.getByLabel('Buscar productos').fill('')
  await page.getByText('2 productos', { exact: true }).waitFor()
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`listado ADMIN ${size.width}`)
  }
  await page.screenshot({
    path: 'docs/screenshots/productos-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize(sizes[0])
  await page.getByRole('button', { name: 'Poco stock', exact: true }).click()
  await page.getByText('1 producto', { exact: true }).waitFor()
  await page.screenshot({
    path: 'docs/screenshots/productos-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize(sizes[2])
  await page.getByRole('link', { name: 'Inicio', exact: true }).click()
  await page
    .locator('.metric-card')
    .filter({
      has: page.getByRole('heading', { name: 'Productos', exact: true }),
    })
    .getByText('2', { exact: true })
    .waitFor()
  await audit('dashboard real')
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  const employeeToken = await signIn(employeeEmail)
  await page.getByRole('link', { name: 'Productos', exact: true }).click()
  await page.getByText('2 productos', { exact: true }).waitFor()
  await page.getByLabel('Buscar productos').fill('AS625')
  await page.getByText('1 producto', { exact: true }).waitFor()
  await page.getByRole('row').filter({ hasText: 'Agua San Luis' }).waitFor()
  await page.getByLabel('Buscar productos').fill('')
  await page.getByText('2 productos', { exact: true }).waitFor()
  check(
    (await page
      .getByRole('button', { name: 'Editar', exact: true })
      .count()) === 0,
    'EMPLOYEE sin editar',
  )
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`listado EMPLOYEE ${size.width}`)
    check(
      (await page
        .getByRole('button', { name: '+ Nuevo producto', exact: true })
        .count()) === 0,
      'EMPLOYEE sin crear',
    )
    check(
      (await page
        .getByRole('button', { name: 'Ajustar stock', exact: true })
        .count()) === 0,
      'EMPLOYEE sin ajustar',
    )
  }
  const list = await page.request.get(`${base}/api/products`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  })
  const id = (await list.json()).items[0].id
  const employeeHeaders = { Authorization: `Bearer ${employeeToken}` }
  const edited = {
    name: 'Intento sin permiso',
    salePrice: '2.00',
    minimumStock: 0,
  }
  const editDenied = await page.request.put(`${base}/api/products/${id}`, {
    headers: employeeHeaders,
    data: edited,
  })
  check(editDenied.status() === 403, 'EMPLOYEE no edita por API')
  const createDenied = await page.request.post(`${base}/api/products`, {
    headers: employeeHeaders,
    data: { ...edited, initialStock: 0, active: true },
  })
  check(createDenied.status() === 403, 'EMPLOYEE no crea por API')
  const forbidden = await page.request.post(
    `${base}/api/products/${id}/stock-adjustments`,
    {
      headers: { Authorization: `Bearer ${employeeToken}` },
      data: { newStock: 100, reason: 'Intento sin permiso' },
    },
  )
  check(forbidden.status() === 403, 'Autorización backend EMPLOYEE')
  check(
    await page.evaluate(
      () =>
        localStorage.length === 0 &&
        sessionStorage.length === 0 &&
        document.cookie === '',
    ),
    'JWT solo memoria',
  )
  check(runtimeErrors.length === 0, 'Errores JavaScript inesperados')
  return {
    results,
    flows:
      'crear, buscar, editar, ajustar, poco stock, desactivar/reactivar, dashboard real y permisos correctos',
    screenshots: 3,
    runtimeErrors: 0,
  }
}
