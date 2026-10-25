# Clientes

Clientes pertenece a `customer/{domain,dto,repository,service,controller}`. No modifica ventas ni V1–V3. V4 crea `customers`; no hay borrado físico.

## Contrato

ADMIN y EMPLOYEE pueden crear, consultar y editar nombre, documento y datos de contacto. Solo ADMIN puede cambiar `active`. POST y PUT no aceptan estado, identificador ni fechas: el servidor crea clientes activos y PUT conserva su estado.

| Ruta | Resultado |
| --- | --- |
| GET `/api/customers?search=&page=0&size=20` | `items`, `total`, `page`, `size`; tamaño 1–100, orden nombre/id |
| GET `/api/customers/{id}` | Información completa |
| POST `/api/customers` | Cliente activo, 201 |
| PUT `/api/customers/{id}` | Reemplaza datos básicos; conserva estado y creación |
| PATCH `/api/customers/{id}/status` | `{active: boolean}`, ADMIN |
| GET `/api/customers/{id}/sales` | Historial real paginado, ADMIN/EMPLOYEE; implementado por el módulo Sale |

Campos de escritura: `name` (obligatorio, 160), `documentType` (DNI/RUC/CE/OTHER, opcional), `documentNumber` (32), `phone` (32), `email` (180), `address` (240), `notes` (1000). Los demás son opcionales; blancos se convierten en null. Nombre y dirección normalizan espacios; documento elimina espacios y pasa a mayúsculas. Sin tipo y con número se usa OTHER. DNI exige 8 dígitos, RUC 11; CE/OTHER aceptan letras, números y separadores punto, barra y guion. No hay consulta oficial ni verificación de identidad.

La pareja tipo/número es única también entre inactivos, mediante índice único en PostgreSQL; múltiples documentos ausentes y correos compartidos están permitidos. Teléfono admite formato internacional manual; elimina espacios, paréntesis y guiones para buscar por dígitos. Búsqueda literal sin distinguir mayúsculas por nombre, documento o teléfono. No se intenta deduplicar personas solo por nombre. GET acepta `active=true` opcional para seleccionar clientes del POS; sin ese parámetro mantiene activos e inactivos en el listado habitual.

Errores: 400 entrada inválida, 401 sin sesión, 403 sin permiso, 404 inexistente, 409 documento duplicado. No se exponen datos personales en logs. La información pertenece al único negocio de esta versión; no existe multiempresa. V5 permite la asociación opcional y consulta de compras desde Sale, sin dependencia circular de servicios; ver [ventas](sales.md). V6 agrega [cuenta y pagos de fiados](accounts.md) al principio del detalle; no incorpora intereses, campañas ni integraciones.

## Interfaz y verificación

`/app/customers` reutiliza navegación, tokens, diálogos, campos y patrones de Productos. Tabla desktop con cliente/documento/teléfono/estado/acciones y tarjetas móviles; estados de carga, vacío, búsqueda vacía, error y guardado. Solo el nombre es obligatorio; contacto adicional se agrupa para evitar un formulario innecesariamente largo.

Las pruebas de API usan un esquema `customer_test_<uuid>` exclusivo y verifican permisos, normalización, duplicados concurrentes, paginación, búsqueda, campos desconocidos y ausencia de DELETE. Pruebas frontend cubren validación y contratos; navegador contra backend y esquema exclusivo, con axe y tamaños 375×812, 768×1024 y 1366×768.
