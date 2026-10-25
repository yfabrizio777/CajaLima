export default async (page) => {
  const base = 'http://127.0.0.1:5173'
  const results = []
  const errors = []
  page.on('pageerror', (error) => errors.push(error.name))
  const check = (condition, message) => {
    if (!condition) throw new Error(message)
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
  const email = `customers-${unique}@example.invalid`
  const employeeEmail = `customers-employee-${unique}@example.invalid`
  const setup = await page.request.get(`${base}/api/auth/setup`)
  check(
    (await setup.json()).available === true,
    'Requiere esquema exclusivo vacío; no usar datos reales',
  )
  const registration = await page.request.post(`${base}/api/auth/register`, {
    data: { name: 'Admin Prueba', email, password },
  })
  check(registration.status() === 201, 'Setup exclusivo de prueba')
  async function login(address) {
    await page.goto(`${base}/login`)
    await page.getByLabel('Correo', { exact: true }).fill(address)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    const response = page.waitForResponse((r) =>
      r.url().endsWith('/api/auth/login'),
    )
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    const result = await response
    check(result.ok(), 'Login real')
    await page.waitForURL('**/app')
    return (await result.json()).token
  }
  const admin = await login(email)
  const adminHeaders = { Authorization: `Bearer ${admin}` }
  check(
    (
      await page.request.post(`${base}/api/users`, {
        headers: adminHeaders,
        data: { name: 'Colaborador Prueba', email: employeeEmail, password },
      })
    ).status() === 201,
    'Empleado temporal',
  )
  await page.setViewportSize(sizes[2])
  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  await page
    .getByRole('heading', { name: 'Agrega tu primer cliente' })
    .waitFor()
  await audit('vacío desktop')
  await page
    .getByRole('button', { name: '+ Nuevo cliente', exact: true })
    .first()
    .click()
  await page
    .getByRole('button', { name: 'Guardar cliente', exact: true })
    .click()
  check(
    await page
      .getByLabel('Nombre', { exact: true })
      .evaluate((el) => el === document.activeElement),
    'Foco en primer error',
  )
  await page.getByLabel('Nombre', { exact: true }).fill('María Quispe')
  await page.getByLabel('Tipo de documento (opcional)').selectOption('DNI')
  await page.getByLabel('Número de documento (opcional)').fill('12 345678')
  await page.getByLabel('Teléfono (opcional)').fill('999 888 777')
  await page
    .getByText('Agregar correo, dirección o una nota', { exact: true })
    .click()
  await page.getByLabel('Correo (opcional)').fill('familia@example.invalid')
  await page.getByLabel('Dirección (opcional)').fill('Av. Lima 123')
  await page.getByLabel('Nota (opcional)').fill('Atender por la tarde.')
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`formulario ${size.width}`)
  }
  await page.setViewportSize(sizes[2])
  await page
    .getByRole('button', { name: 'Guardar cliente', exact: true })
    .click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const row = page.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: 'María Quispe', exact: true }),
  })
  await row.waitFor()
  await row.getByRole('button', { name: 'Ver', exact: true }).click()
  await page
    .getByRole('definition')
    .filter({ hasText: 'Av. Lima 123' })
    .waitFor()
  await audit('detalle desktop')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByLabel('Buscar clientes').fill('12345678')
  await row.waitFor()
  check(
    (await page
      .getByRole('rowheader', { name: 'María Quispe', exact: true })
      .count()) === 1,
    'Búsqueda por documento',
  )
  await row.getByRole('button', { name: 'Editar', exact: true }).click()
  await page
    .getByLabel('Nombre', { exact: true })
    .fill('María Quispe Actualizada')
  await page
    .getByRole('button', { name: 'Guardar cliente', exact: true })
    .click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const updated = page.getByRole('row').filter({
    has: page.getByRole('rowheader', {
      name: 'María Quispe Actualizada',
      exact: true,
    }),
  })
  await updated.getByRole('button', { name: 'Desactivar', exact: true }).click()
  await updated.getByText('Inactivo', { exact: true }).waitFor()
  await updated.getByRole('button', { name: 'Reactivar', exact: true }).click()
  await updated.getByText('Activo', { exact: true }).waitFor()
  await page
    .getByRole('button', { name: '+ Nuevo cliente', exact: true })
    .click()
  await page.getByLabel('Nombre', { exact: true }).fill('Duplicado')
  await page.getByLabel('Tipo de documento (opcional)').selectOption('DNI')
  await page.getByLabel('Número de documento (opcional)').fill('12345678')
  await page
    .getByRole('button', { name: 'Guardar cliente', exact: true })
    .click()
  await page
    .getByRole('alert')
    .filter({ hasText: 'Ese documento ya está registrado' })
    .waitFor()
  await page.keyboard.press('Escape')
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`listado ${size.width}`)
  }
  await page.setViewportSize(sizes[0])
  await page
    .getByRole('article', { name: 'María Quispe Actualizada', exact: true })
    .getByRole('button', { name: 'Ver', exact: true })
    .click()
  await page
    .getByRole('definition')
    .filter({ hasText: 'María Quispe Actualizada' })
    .waitFor()
  await audit('detalle móvil')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.screenshot({
    path: 'docs/screenshots/clientes-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize(sizes[2])
  await page.screenshot({
    path: 'docs/screenshots/clientes-desktop.png',
    fullPage: true,
  })
  const employee = await login(employeeEmail)
  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
  await page
    .getByRole('rowheader', { name: 'María Quispe Actualizada', exact: true })
    .waitFor()
  check(
    (await page
      .getByRole('button', { name: 'Desactivar', exact: true })
      .count()) === 0,
    'Empleado no tiene control de estado',
  )
  await page
    .getByRole('button', { name: '+ Nuevo cliente', exact: true })
    .click()
  await page.getByLabel('Nombre', { exact: true }).fill('Luis Pérez')
  await page
    .getByRole('button', { name: 'Guardar cliente', exact: true })
    .click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const luis = page.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: 'Luis Pérez', exact: true }),
  })
  await luis.getByRole('button', { name: 'Editar', exact: true }).click()
  await page.getByLabel('Teléfono (opcional)').fill('988777666')
  await page
    .getByRole('button', { name: 'Guardar cliente', exact: true })
    .click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await luis.getByText('988777666', { exact: true }).waitFor()
  const headers = { Authorization: `Bearer ${employee}` }
  const listed = await page.request.get(`${base}/api/customers?search=Luis`, {
    headers,
  })
  const customer = (await listed.json()).items[0]
  check(
    (
      await page.request.patch(`${base}/api/customers/${customer.id}/status`, {
        headers,
        data: { active: false },
      })
    ).status() === 403,
    'Estado de empleado rechazado también por API',
  )
  check(
    (
      await page.request.delete(`${base}/api/customers/${customer.id}`, {
        headers: adminHeaders,
      })
    ).status() === 405,
    'Sin DELETE físico',
  )
  await audit('empleado desktop')
  await page.getByLabel('Buscar clientes').fill('Nadie con este nombre')
  await page.getByRole('heading', { name: 'No encontramos clientes' }).waitFor()
  await page.getByLabel('Buscar clientes').fill('Luis')
  await luis.waitFor()
  await page.context().setOffline(true)
  await page.getByLabel('Buscar clientes').fill('Sin conexión')
  await page
    .getByRole('alert')
    .filter({ hasText: 'No pudimos conectar' })
    .waitFor()
  await page.context().setOffline(false)
  await page
    .getByRole('button', { name: 'Volver a intentar', exact: true })
    .click()
  await page.getByRole('heading', { name: 'No encontramos clientes' }).waitFor()
  check(
    await page.evaluate(
      () =>
        localStorage.length === 0 &&
        sessionStorage.length === 0 &&
        document.cookie === '',
    ),
    'Sin almacenamiento persistente',
  )
  check(!errors.length, `Errores inesperados: ${errors.join(', ')}`)
  return {
    results,
    flows:
      'ADMIN y EMPLOYEE: crear, ver, editar, buscar; estado solo ADMIN; duplicados; vacío; error recuperable; Escape y foco; sin DELETE',
    runtimeErrors: errors.length,
  }
}
