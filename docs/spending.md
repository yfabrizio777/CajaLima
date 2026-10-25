# Gastos y compras

## Modelo y alcance

V7 agrega `expenses`, `purchases` y `purchase_items`; V1–V6 no cambian. Se separan los gastos operativos de las compras porque solo estas últimas contienen productos y producen entradas de inventario. Proveedor es texto opcional, sin entidad ni catálogo. No hay cuentas por pagar, órdenes, anulaciones, eliminación física, impuestos calculados, SUNAT ni integraciones de pago.

Expense registra descripción, categoría, importe positivo, medio, fecha de negocio, notas y auditoría. Categorías: RENT, SERVICES, TRANSPORT, SUPPLIES, MAINTENANCE y OTHER. Purchase registra descripción, proveedor opcional, medio, fecha, notas, total del servidor y autor; sus items conservan producto/nombre, cantidad, costo unitario y subtotal como snapshots. Los medios son CASH, YAPE, PLIN y TRANSFER, independientes del medio CREDIT de ventas.

Importes BigDecimal/NUMERIC, hasta dos decimales. Gasto/total máximo: 999999999999.99; costo unitario positivo máximo: 99999999.99. Compra de 1–100 productos distintos, cantidades enteras 1–1000000; stock final máximo 1000000. Fechas entre 2000-01-01 y 2100-12-31. Descripción/proveedor hasta 160 caracteres y notas hasta 500; campos opcionales vacíos se normalizan a null. Se rechazan NUL y pares Unicode inválidos. No se acepta total, subtotal, stock ni actor enviados por cliente.

## Transacciones y reintentos

PurchaseService bloquea productos por ID ascendente con el mismo `findLocked` usado por ventas/ajustes. Valida producto activo y stock final bajo bloqueo; calcula subtotales/total; guarda compra, items, stock y movimientos PURCHASE dentro de una transacción. Fallar cualquier inserción revierte todo. No actualiza automáticamente el costo del catálogo. V7 agrega `purchase_id`, FK y unicidad por compra/producto; PURCHASE exige cantidad positiva y referencia propia, conservando las reglas anteriores de SALE/INITIAL/ADJUSTMENT.

POST requiere `requestId` UUID único por recurso. El fingerprint usa campos con longitud explícita, decimales canónicos e items ordenados; incluye todos los datos originales. Se compara también el actor autenticado. Una repetición devuelve el mismo registro; distinto contenido/actor recibe 409. La unicidad SQL resuelve contención, incluso entre productos diferentes. Un gasto simultáneo puede recibir 409 mientras se confirma el original: reintentar con el mismo UUID. No se intenta continuar una transacción PostgreSQL abortada. Editar descripción/proveedor/notas conserva el fingerprint original y la auditoría de creación.

El frontend guarda el intento antes de enviar, en sessionStorage por actor y recurso, sin JWT. Congela datos ante resultado incierto, incluidos errores 409; una recarga/login en la misma pestaña restaura UUID y valores. «Comprobar y reintentar» no duplica operaciones. Para corregir una solicitud rechazada se exige una acción explícita tras revisar el historial y se conserva su referencia. Al cerrar la pestaña puede perderse el intento: revisar el historial antes de registrar otra operación. El almacenamiento deshabilitado bloquea la creación antes de enviar.

## API y permisos

Ambos roles ADMIN/EMPLOYEE crean y consultan registros del único negocio. No existe aislamiento multiempresa. Sin acceso anónimo; actor del JWT validado y rechazo de campos desconocidos. Solo ADMIN puede reemplazar los datos descriptivos mediante PUT `/details`; importe, categoría, fecha, medio, items y autor permanecen inmutables por API.

| Método/ruta | Contrato |
| --- | --- |
| POST `/api/expenses` | requestId, description, category, amount, paymentMethod, expenseDate, notes opcional; 201 |
| GET `/api/expenses` | q literal en descripción, from/to inclusivos, category, page/size |
| GET `/api/expenses/{id}` | Registro y auditoría; 404 si no existe |
| PUT `/api/expenses/{id}/details` | ADMIN; description y notes opcional |
| POST `/api/purchases` | requestId, description, supplierName/notes opcionales, paymentMethod, purchaseDate, items [{productId, quantity, unitCost}]; 201 |
| GET `/api/purchases` | q literal en descripción/proveedor, from/to inclusivos, page/size |
| GET `/api/purchases/{id}` | `{purchase, items}` con snapshots y auditoría |
| PUT `/api/purchases/{id}/details` | ADMIN; description, supplierName/notes opcionales |
| GET `/api/expenses/summary`, `/api/purchases/summary` | `{total, date}` de la fecha de negocio actual en America/Lima |

Listados `{items,total,page,size}`, página base cero hasta 100000 y tamaño 1–100 (UI 12), orden descendente por ID. Fechas invertidas, filtros demasiado largos e importes inválidos: 400; producto/registro inexistente: 404; inactivo, límite de stock o referencia incompatible: 409. No hay DELETE. Importes de respuesta como cadenas decimales exactas; sumas preliminares frontend en céntimos BigInt. Las métricas del dashboard suman la fecha declarada del gasto/compra, no el instante de creación; no calculan rentabilidad ni flujo de caja combinado.

## UX y verificación

`/app/expenses` activa Gastos y ofrece acceso a Compras mediante navegación interna. Cards adaptables, filtros, estados vacíos/error/carga, detalle y edición descriptiva ADMIN; formularios con foco al primer error. La compra permite buscar productos y paginarlos, añadir líneas y ver subtotal/total antes de confirmar. El costo registrado queda visible en el detalle.

Pruebas y reproducción: [verification.md](verification.md). Las decisiones de transacción y bloqueo siguen la [documentación oficial de Spring Data JPA](https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html). Strix sigue pendiente antes del despliegue público.
