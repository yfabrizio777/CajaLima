# Verificación de Fase B

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
