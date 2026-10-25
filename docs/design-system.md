# Diseño y arquitectura de CajaLima

La descripción de Fase B conserva el contexto histórico del backend de `36bfac6`: configuración inicial, login, dashboard vacío y 404. Los módulos actuales y sus verificaciones se detallan en README y en sus documentos de producto, ventas y clientes.

## Identidad

Los tokens se centralizan en `frontend/src/styles/index.css` con Tailwind CSS v4. Azul `#005A9C`, amarillo `#FFCC00`, verde `#2E7D32`, fondo `#FDFBF7`, texto `#0F2B48`, texto secundario `#4A5D6E` y borde `#E5DFD5`. Los campos usan un borde más oscuro para distinguirse. Inter variable se sirve desde archivos locales de Fontsource. El amarillo es un acento con texto oscuro.

El logo local proviene del PNG válido de `logo_cajalima_paleta_design.md` del ZIP de Stitch. Los HTML y documentos se usaron como referencia; las seis capturas con «Image failed to fetch» no se incorporaron. No hay recursos remotos temporales. La tienda y los iconos son SVG propios; `kusi-placeholder.svg` es una representación provisional discreta, reemplazable cuando exista una ilustración oficial reutilizable. Kusi no es IA.

La interfaz prioriza contenido y formularios, con personalidad en mensajes y estados vacíos. Mobile-first: menú desplegable en teléfono y tablet, sidebar desde 1024 px. Los módulos futuros no tienen acciones y se identifican como «Próximamente». Los ceros del dashboard están rotulados como vista inicial sin datos de negocio.

## Estructura

```text
frontend/src/
  app/                 Router, protección y proveedor de sesión
  assets/brand/        Logo y placeholder local de Kusi
  components/layout/   AuthLayout y AppLayout
  components/ui/       Brand, Field, Icon, KusiNote, Storefront
  features/auth/       Formularios, páginas, contratos, validación y API
  features/home/       DashboardPage sin operaciones de negocio
  lib/                 Cliente HTTP y formatos es-PE
  styles/              Tokens y estilos responsive
```

React Router declara `/setup`, `/login`, `/app` y 404. React Context conserva la sesión en memoria. El registro envía únicamente nombre, correo y contraseña; el servidor asigna ADMIN. Login obtiene JWT y consulta `/api/auth/me` antes de abrir el área privada. Logout, expiración y recarga completa eliminan la sesión del cliente. No existe revocación anticipada de JWT en el servidor en esta versión.

`features/auth/api.ts` concentra el contrato de autenticación y `lib/http.ts` es el único lugar con fetch. Valida la URL pública, omite cookies, impide redirecciones de peticiones autenticadas, limita el tiempo de espera y transforma errores en mensajes controlados. Las respuestas se validan como datos desconocidos antes de usarlas. React escapa texto; no se usa HTML dinámico.

Graphify encontró el camino `AuthForm → submit → registerOwner → request` y `AuthController → AuthService → UserRepository → User`. El enlace HTTP entre ambos grafos y la persistencia PostgreSQL se verificaron con llamadas reales y revisión del código, no se presentan como aristas inferidas automáticamente por la herramienta.

Configuración consultada mediante Context7: [Vite](https://vite.dev/config/server-options.html), [Tailwind con Vite](https://tailwindcss.com/docs/installation/using-vite), [React Router](https://reactrouter.com/start/declarative/installation), [Fontsource](https://fontsource.org/docs/getting-started/install) y [axe](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md). No se incorporan Redux ni librerías completas de UI.

## Clientes

`features/customers` agrega listado, formulario y detalle en `/app/customers`; Clientes es navegación activa junto con Productos y Ventas. Se reutilizan Dialog, Field, KusiNote, tipos visuales y estilos de Productos. Solo el nombre es obligatorio; correo, dirección y nota están agrupados en un desplegable. Tabla desde 1024 px y tarjetas por debajo, con acciones Ver/Editar y cambio de estado exclusivo de ADMIN. Los datos y permisos vienen del backend real; no hay almacenamiento persistente de clientes ni nueva librería de UI.

La implementación conserva limpieza/cancelación de consultas con `useEffect`, documentada en [React](https://react.dev/reference/react/useEffect), y búsqueda paginada con [Specifications de Spring Data JPA](https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html), consultadas mediante Context7.
