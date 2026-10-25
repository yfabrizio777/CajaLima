# Verificación de CajaLima

## Clientes — 25/10/2026

Base: `a8abc87`. V4 agrega clientes; V1–V3 no se modifican. Sin cambios de versiones ni asociación con ventas.

| Comprobación | Resultado |
| --- | --- |
| `mvn clean test` | 88 pruebas, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS |
| Distribución backend | 71 anteriores + 17 de clientes |
| Ciclo de prueba | Alta inicial falló con 404 antes de implementar; después pasó. Una mutación temporal del permiso de estado fue detectada (403 esperado frente a 200); regla ADMIN restaurada y suite final correcta |
| `npm ci`, `npm test` | Instalación desde lockfile correcta; 15 pruebas, 0 fallos, 0 omitidas |
| `npm run lint`, `npm run build`, `npm run format:check` | Correctos, sin supresiones |
| Navegador Chromium, backend real | ADMIN y EMPLOYEE crean, consultan, editan y buscan; solo ADMIN desactiva/reactiva; duplicados rechazados; vacío, búsqueda vacía y error de conexión recuperable |
| Autorización por API | EMPLOYEE recibe 403 al cambiar estado; DELETE de ADMIN recibe 405 y conserva el cliente |
| Responsive y axe | 10 comprobaciones de listado, formulario, detalle, vacío y empleado; 0 infracciones WCAG detectadas, sin overflow horizontal; tamaños 375×812, 768×1024, 1366×768 |
| JavaScript y teclado | 0 errores inesperados; primer error enfocado; Escape cierra diálogo; sesión sin almacenamiento persistente |
| PostgreSQL | 17.10, healthy en 127.0.0.1:5433. V4 aplicada correctamente en esquemas de prueba |
| Datos principales | `public` conservó V1–V3, 1 usuario, 0 productos, 0 ventas; V4 no se aplicó a ese esquema durante las pruebas |

Se revisaron visualmente `clientes-desktop.png` y `clientes-mobile.png`, con datos ficticios del esquema exclusivo. Las instancias temporales de backend/Vite y el navegador se cerraron; los esquemas de pruebas se eliminaron. Docker/PostgreSQL permanecen activos; no se eliminaron volúmenes. Nunca se utilizó 8180.

Las tres suites de integración anteriores y la nueva usan sus propios esquemas. Para que `CajalimaApplicationTests` tampoco migre el esquema principal, se ejecutó la suite desde `backend` con estas variables limitadas al proceso de prueba:

```powershell
$testSchema = 'customers_smoke_' + [guid]::NewGuid().ToString('N')
$env:SPRING_FLYWAY_SCHEMAS = $testSchema
$env:SPRING_JPA_PROPERTIES_HIBERNATE_DEFAULT_SCHEMA = $testSchema
$env:SPRING_DATASOURCE_HIKARI_SCHEMA = $testSchema
mvn clean test
```

Usar una terminal dedicada y cerrarla al terminar. Eliminar únicamente `$testSchema`, una vez terminada la suite, después de verificar su nombre y que fue creado por esa ejecución. Las suites de integración limpian sus esquemas automáticamente.

### Reproducir navegador de clientes

Iniciar un backend con un esquema nuevo `customers_browser_<uuid>`, configurando las mismas tres variables de esquema y un JWT privado temporal; usar 8080 y Vite 5173 si están libres. No usar el esquema principal. El flujo exige setup disponible, crea cuentas y clientes ficticios, y no imprime contraseña ni JWT.

```powershell
playwright-cli.cmd -s=cajalima-customers open http://127.0.0.1:5173/login
$flow = [IO.File]::ReadAllText((Join-Path (Get-Location) 'frontend/tests/customers-browser-flow.js')).Replace('export default ', '')
[IO.File]::WriteAllText((Join-Path (Get-Location) 'customers-browser-flow.tmp'), $flow)
playwright-cli.cmd -s=cajalima-customers --raw run-code --filename=customers-browser-flow.tmp
playwright-cli.cmd -s=cajalima-customers close
```

Al terminar, detener solo las instancias creadas y eliminar exclusivamente el esquema nuevo de navegador. No borrar `public` ni volúmenes.

### Límites de seguridad pendientes

Los avisos de la auditoría inicial siguen vigentes: `npm audit` detectó dos paquetes con severidad alta en herramientas de desarrollo/build (Vite 8.3.0 y source-map-js 1.2.1); `npm audit --omit=dev` reportó 0 vulnerabilidades conocidas. No se añadieron dependencias ni se cambió el lockfile en clientes. Requieren revisión y corrección separada antes del despliegue público; no representan un pentest de CajaLima.

Strix continúa pendiente: autenticación reconocida pero `STRIX_LLM` sin definir en la auditoría inicial; no se ejecutó pentest. No se desplegó la aplicación públicamente. Los resultados Graphify anteriores conservan su fecha y base históricas; no se presentan como verificación del módulo nuevo.

## Productos e inventario — 14/09/2026

Base: `8bb530f`. Se conservan las pruebas anteriores; V1 no cambia y V2 ya aplicada no se reescribe.

| Comprobación | Resultado |
| --- | --- |
| `mvn clean test` directo desde backend | 50 pruebas, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS |
| Distribución backend | 25 anteriores + 25 de productos/inventario |
| Concurrencia | Dos ajustes simultáneos conservan la cadena previous_stock/new_stock y el stock final |
| `npm test` | 7 pruebas correctas |
| `npm run lint`, `npm run build`, `npm run format:check` | Correctos |
| `npm audit` | 0 vulnerabilidades reportadas |
| Playwright CLI / Chromium | ADMIN crea, busca por nombre/SKU, edita, ajusta, desactiva/reactiva; EMPLOYEE consulta y busca, no puede crear/editar/ajustar |
| Autorización real | Escrituras de EMPLOYEE rechazadas con 403 también por API |
| Responsive / axe | Listado, nuevo producto y ajuste a 375×812, 768×1024 y 1366×768: 0 infracciones WCAG detectadas y sin overflow horizontal |
| Dashboard | Número real de productos activos verificado; ventas pendiente |
| JavaScript / almacenamiento | 0 errores inesperados; localStorage/sessionStorage vacíos y sin cookies de sesión |
| Graphify | Frontend 108 nodos/299 aristas; backend 238 nodos/507 aristas; sin ciclos de imports en ambos |

Revisión manual: DTOs explícitos y rechazo de campos desconocidos, autorización en servicios, datos del actor tomados del JWT validado, stock previo leído bajo bloqueo y stock nuevo validado. SQL parametrizado y constraints de integridad/uniqueness. No hay endpoint para falsificar o editar movimientos. La consulta por ID es compartida por los dos roles del mismo negocio; no hay multiempresa. Ningún secreto se añade al frontend. Los errores internos permanecen controlados.

**Strix pendiente por entorno de autenticación.** `strix auth status` reconoce la suscripción; `STRIX_LLM` no existe en esta sesión. No se ejecutó pentest. Sigue siendo security gate obligatorio antes del despliegue público.

Las tres capturas nuevas revisadas son `productos-desktop.png`, `producto-nuevo.png` y `productos-mobile.png`. Se conservan las capturas históricas de Fase B; no representan métricas actuales.

### Entorno de navegador aislado

Se usaron backend 8081, Vite 5174 y el esquema exclusivo `products_browser_20260913`, con cuentas y productos temporales. No se alteraron cuentas ni productos del esquema principal. Al finalizar se detuvieron las dos instancias de prueba y se eliminó únicamente ese esquema. PostgreSQL y las instancias habituales se conservaron.

El flujo versionado es `frontend/tests/products-browser-flow.js`. Para reproducirlo, inicia un backend local con un esquema **nuevo y exclusivo de pruebas** configurado en `spring.flyway.schemas`, `spring.jpa.properties.hibernate.default_schema` y `spring.datasource.hikari.schema`; usa `BACKEND_PORT=8081`. Los secretos siguen procediendo de `run-local.ps1`, nunca del script del navegador. Inicia Vite con `VITE_PROXY_TARGET=http://127.0.0.1:8081` y `npm run dev -- --port 5174`.

Desde la raíz, con esas instancias activas:

```powershell
playwright-cli.cmd open http://127.0.0.1:5174/login
$flow = [IO.File]::ReadAllText((Join-Path (Get-Location) 'frontend/tests/products-browser-flow.js')).Replace('export default ', '')
[IO.File]::WriteAllText((Join-Path (Get-Location) 'products-browser-flow.tmp'), $flow)
playwright-cli.cmd --raw run-code --filename=products-browser-flow.tmp
playwright-cli.cmd close
```

El flujo requiere setup disponible, genera credenciales aleatorias en memoria y sobrescribe las mismas tres capturas. No imprime tokens ni contraseñas. Al terminar, detén las instancias y elimina exclusivamente el esquema que creaste para esa ejecución. Nunca ejecutar limpieza sobre `public` ni borrar el volumen. Los esquemas de las pruebas Maven se generan y eliminan automáticamente.

## Histórico: Fase B

Fecha local: 13/09/2026. Base: `36bfac63b32196ff867805bb3d51a8d29f9edcc8`. No se modificaron archivos backend ni V1.

| Comprobación | Resultado |
| --- | --- |
| Docker Compose | PostgreSQL 17 healthy, puerto local 5433 |
| `mvn clean test` | 25 pruebas, 0 fallos, 0 errores, 0 omitidas |
| `npm run lint` | Correcto, sin supresiones |
| `npm run format:check` | Correcto |
| `npm run build` | TypeScript estricto y Vite correctos |
| `npm test` | 4 pruebas correctas: formatos, validación y contratos |
| `npm audit` | 0 vulnerabilidades reportadas |
| Playwright CLI, Chromium | Setup, segundo setup, login incorrecto/correcto, me, dashboard, logout, ruta privada, refresh y 404 correctos |
| Axe | 0 infracciones detectadas en setup/login/dashboard/404 a 375×812, 768×1024 y 1366×768, y en menú móvil/tablet |
| Responsive y teclado | Sin overflow horizontal; error enfoca primer campo; Escape cierra menú y devuelve foco |
| Almacenamiento | localStorage y sessionStorage vacíos; sin cookies de sesión |
| Graphify | Frontend: 73 nodos, 177 aristas, sin ciclos de imports; backend: 151 nodos, 325 aristas |

Playwright utilizó el backend real, sin mocks. `/api/auth/me` respondió 200 y confirmó ADMIN. El segundo registro respondió 403. La cuenta temporal generó credenciales aleatorias en memoria; al terminar se eliminó únicamente esa cuenta identificada por correo y nombre. La configuración inicial volvió a estar disponible. No se eliminaron volúmenes ni otros datos.

Se revisaron visualmente cinco capturas completas en `docs/screenshots`: `setup-desktop.png`, `login-desktop.png`, `dashboard-1366.png`, `dashboard-375.png` y `404-desktop.png`. «Fabrizio Prueba» identifica una cuenta temporal, no una cuenta precargada. Axe no sustituye una auditoría completa con tecnologías de asistencia.

## Reproducir navegador

Requiere backend y Vite activos, Playwright CLI instalado y una base de prueba sin usuarios. El flujo crea un administrador temporal: no ejecutarlo sobre una instalación con cuentas reales esperando que reinicie el setup. No borra cuentas automáticamente. Devuelve exclusivamente el correo temporal para permitir su limpieza precisa, nunca contraseña ni JWT.

Desde la raíz en PowerShell:

```powershell
playwright-cli.cmd open http://127.0.0.1:5173
$flow = [IO.File]::ReadAllText((Join-Path (Get-Location) 'frontend/tests/browser-flow.js')).Replace('export default ', '')
[IO.File]::WriteAllText((Join-Path (Get-Location) 'browser-flow.tmp'), $flow)
playwright-cli.cmd --raw run-code --filename=browser-flow.tmp
playwright-cli.cmd close
```

El adaptador temporal permite ejecutar el módulo revisable con el formato de expresión de Playwright CLI. `*.tmp` y los artefactos internos del navegador están ignorados. Las capturas se sobrescriben para no acumular duplicados. No guardar trazas, respuestas de login ni estados de almacenamiento con credenciales.

## Seguridad y límites

**Strix pendiente de ejecución por entorno de autenticación.** `strix auth status` reconoce una suscripción ChatGPT, pero `STRIX_LLM` no está definido en el proceso de Codex. No se ejecutó pentest ni se inventaron resultados. Se completaron pruebas backend, navegador, axe, revisión manual y auditoría npm.

Graphify sí se ejecutó localmente sin LLM. Sus archivos generados permanecen ignorados. La revisión manual confirmó roles exclusivamente del servidor, JWT en memoria, API centralizada, campos internos no enviados, respuestas validadas y ausencia de secretos en los archivos preparados para Git. Las cabeceras de seguridad del frontend y HTTPS deberán configurarse en el servidor de despliegue. El backend mantiene sus límites documentados, incluido que aún no hay rate limiting de login.
