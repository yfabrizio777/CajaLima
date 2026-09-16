# Ventas y POS

V3 agrega `sales` y `sale_items`, y permite movimientos `SALE` vinculados a una venta. V1 y V2 permanecen intactas. Los items conservan nombre y precio del producto al vender; las ediciones posteriores no cambian el comprobante interno. Este registro no es un comprobante fiscal.

## Contrato

Todos los endpoints requieren un usuario activo ADMIN o EMPLOYEE. Comparten la información del mismo negocio; no existe multiempresa.

| Endpoint | Resultado |
| --- | --- |
| `POST /api/sales` | 201 con venta y detalle; reintentos idénticos devuelven la misma venta |
| `GET /api/sales?page=0&size=20&date=2026-09-14` | Historial descendente por fecha e ID; fecha opcional, máximo 100 por página |
| `GET /api/sales/{id}` | Detalle con snapshots, total, medio, autor y fecha |
| `GET /api/sales/summary` | Importe, cantidad y fecha del día actual en `America/Lima` |

El POST recibe `requestId` UUID, `paymentMethod` (`CASH`, `YAPE`, `PLIN`, `TRANSFER`) e `items`: entre 1 y 100 productos distintos, cada uno con `productId` y `quantity` entera entre 1 y 1 000 000. Rechaza campos desconocidos, cantidades fraccionarias, duplicados, productos inexistentes/inactivos y stock insuficiente. El cliente no envía precio, subtotal, total, rol ni autor. No hay integraciones de cobro.

Precios y operaciones usan BigDecimal; PostgreSQL guarda NUMERIC. El total admite hasta 999 999 999 999,99 y nunca se redondea desde un valor flotante. El cliente calcula solamente una vista previa en céntimos; la confirmación muestra la respuesta del servidor. Una modificación concurrente del precio puede cambiar el total final.

## Transacción y concurrencia

`SaleService.create` delimita una sola transacción: bloquea los productos por ID ascendente, valida estado y disponibilidad, calcula importes, guarda venta y items, reduce stock y crea un movimiento negativo SALE por producto con autor y referencia. Todos los escritores de stock utilizan el mismo bloqueo pesimista de producto. El orden estable evita adquirir esos bloqueos en orden inverso. Cualquier fallo revierte la operación completa; las constraints de PostgreSQL refuerzan cantidades, importes y relaciones.

El UUID de solicitud es único. El servidor guarda una huella SHA-256 del medio y de los productos/cantidades ordenados. Una repetición del mismo usuario y contenido devuelve la venta original; otro usuario o contenido recibe conflicto. Se comprueba también después de adquirir los bloqueos, para resolver dos reintentos simultáneos. La huella no contiene credenciales.

El frontend conserva esa referencia al fallar la red o recibir un resultado incierto, bloquea la edición y ofrece reintentar. No guarda el carrito ni JWT en almacenamiento persistente. Después de salir o recargar, hay que revisar el historial antes de repetir una operación incierta.

## Interfaz

`useSalesApi` centraliza HTTP mediante el cliente autenticado existente. `SalesPage` coordina catálogo paginado, búsqueda y carrito; `PosProducts`, `Cart`, `SaleConfirmation` y `SaleDetail` separan responsabilidades. `SalesHistoryPage` consulta listado y detalle. Las funciones puras de `cartState` validan cantidades y calculan la vista previa. Los DTO recibidos se validan antes de usarse.

Desktop muestra catálogo y carrito en columnas; móvil los apila y permite saltar al carrito con foco. Se mantienen tokens CajaLima, Inter local, controles táctiles, etiquetas, foco visible y mensajes asociados. El dashboard obtiene ventas y cantidad reales del resumen del servidor, con límites del día en Perú.

No se implementan clientes, descuentos, impuestos, anulaciones, devoluciones, reportes ni pasarelas. Las limitaciones de autenticación y despliegue del README siguen vigentes. Resultados y reproducción: [verificación](verification.md).
