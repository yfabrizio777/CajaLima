export default async (page) => {
  const runtimeErrors = []
  const recordError = (error) => runtimeErrors.push(error.name)
  page.on('pageerror', recordError)
  const base = 'http://127.0.0.1:5173'
  const sizes = [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
  ]
  const results = []
  const check = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  async function audit(screen) {
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
    check(!violations.length, JSON.stringify({ screen, violations }))
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow: ${screen}`,
    )
    results.push(`${screen}: axe 0, sin overflow`)
  }
  await page.goto(`${base}/setup`)
  await page.getByRole('heading', { name: 'Configuremos CajaLima' }).waitFor()
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`setup ${size.width}`)
  }
  await page.screenshot({
    path: 'docs/screenshots/setup-desktop.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click()
  check(
    (await page.locator('#name').getAttribute('aria-invalid')) === 'true',
    'Validación accesible',
  )
  check(
    await page.locator('#name').evaluate((el) => el === document.activeElement),
    'Foco del primer error',
  )
  const unique = await page.evaluate(() => crypto.randomUUID())
  const email = `e2e-${unique}@example.invalid`
  const password = await page.evaluate(
    () => crypto.randomUUID() + crypto.randomUUID().slice(0, 12),
  )
  await page.getByLabel('Nombre', { exact: true }).fill('Fabrizio Prueba')
  await page.getByLabel('Correo', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(password)
  const registration = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/auth/register') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click()
  const registered = await registration
  check(registered.ok(), 'Registro inicial real')
  await page.waitForURL('**/login')
  results.push('setup inicial: correcto')
  const second = await page.request.post(`${base}/api/auth/register`, {
    data: { name: 'Segundo', email: `second-${email}`, password },
  })
  check(second.status() === 403, 'Segundo setup debe rechazarse')
  await page.goto(`${base}/setup`)
  await page.waitForURL('**/login')
  results.push('segundo setup: 403 y orientación a login')
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`login ${size.width}`)
  }
  await page.screenshot({
    path: 'docs/screenshots/login-desktop.png',
    fullPage: true,
  })
  await page.getByLabel('Correo', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(`${password}x`)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('alert').waitFor()
  results.push('login incorrecto: mensaje accesible')
  async function signIn() {
    await page.getByLabel('Correo', { exact: true }).fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    const meResponse = page.waitForResponse((r) =>
      r.url().endsWith('/api/auth/me'),
    )
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    const me = await meResponse
    check(
      me.status() === 200 && (await me.json()).role === 'ADMIN',
      'me confirma ADMIN real',
    )
    await page.waitForURL('**/app')
  }
  await signIn()
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`dashboard ${size.width}`)
    if (size.width === 375 || size.width === 1366)
      await page.screenshot({
        path: `docs/screenshots/dashboard-${size.width}.png`,
        fullPage: true,
      })
    if (size.width < 1024) {
      await page.getByRole('button', { name: 'Abrir menú' }).click()
      await audit(`menú ${size.width}`)
      await page.keyboard.press('Escape')
      check(
        await page
          .getByRole('button', { name: 'Abrir menú' })
          .evaluate((el) => el === document.activeElement),
        'Escape devuelve foco',
      )
    }
  }
  check(
    await page.evaluate(
      () =>
        localStorage.length === 0 &&
        sessionStorage.length === 0 &&
        document.cookie === '',
    ),
    'Sin almacenamiento persistente',
  )
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await page.waitForURL('**/login')
  await page.goto(`${base}/app`)
  await page.waitForURL('**/login')
  results.push('logout y ruta privada: correctos')
  await signIn()
  await page.reload()
  await page.waitForURL('**/login')
  results.push('refresh: sesión en memoria perdida, redirige a login')
  await page.goto(`${base}/ruta-inexistente`)
  await page.getByRole('heading', { name: 'Uy, por acá no era.' }).waitFor()
  for (const size of sizes) {
    await page.setViewportSize(size)
    await audit(`404 ${size.width}`)
  }
  await page.screenshot({
    path: 'docs/screenshots/404-desktop.png',
    fullPage: true,
  })
  page.off('pageerror', recordError)
  check(runtimeErrors.length === 0, 'Errores JavaScript inesperados')
  return { results, cleanupEmail: email, screenshots: 5, runtimeErrors: 0 }
}
