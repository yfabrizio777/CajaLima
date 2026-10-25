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

### Cliente opcional (V5)

POST acepta además `customerId` positivo opcional. Ausente o null mantiene una venta a Público general; no se crea un Customer artificial. Si se proporciona, el backend exige un cliente existente (404 si falta) y activo (409, «El cliente seleccionado no está activo.»). ADMIN y EMPLOYEE tienen los mismos permisos para asociar y consultar compras del único negocio actual.

V5 agrega `sales.customer_id` nullable con FK a customers, sin cascadas, e índice parcial `(customer_id, created_at DESC, id DESC)` para su historial. `Sale.customer` es ManyToOne lazy opcional, sin cascade. Las ventas anteriores permanecen sin cliente y no se inventan relaciones. Desactivar o editar un cliente no elimina ni modifica importes/items de sus ventas. La respuesta agrega `customer: {id, name, documentType, documentNumber}` o null; no devuelve teléfono, dirección, correo ni notas. Nombre y documento reflejan la ficha actual del cliente; los snapshots de productos permanecen intactos.

`GET /api/customers/{id}/sales?page=0&size=20` devuelve únicamente id, total, paymentMethod y createdAt de cada venta, con items/total/page/size. Orden descendente por fecha e id; tamaño 1–100 y página acotada. Existe historial también para clientes inactivos; un cliente inexistente recibe 404. Ambos roles consultan el historial compartido del negocio; no existe multiempresa. No se añade resumen avanzado ni endpoint summary.

El endpoint lo implementa `sale/controller/CustomerSalesController` y delega en SaleService → SaleRepository. Así, Sale puede depender de CustomerRepository sin que CustomerService dependa de servicios o repositorios de Sale.

Precios y operaciones usan BigDecimal; PostgreSQL guarda NUMERIC. El total admite hasta 999 999 999 999,99 y nunca se redondea desde un valor flotante. El cliente calcula solamente una vista previa en céntimos; la confirmación muestra la respuesta del servidor. Una modificación concurrente del precio puede cambiar el total final.

## Transacción y concurrencia

`SaleService.create` delimita una sola transacción: bloquea los productos por ID ascendente, valida estado y disponibilidad, calcula importes, guarda venta y items, reduce stock y crea un movimiento negativo SALE por producto con autor y referencia. Todos los escritores de stock utilizan el mismo bloqueo pesimista de producto. El orden estable evita adquirir esos bloqueos en orden inverso. Cualquier fallo revierte la operación completa; las constraints de PostgreSQL refuerzan cantidades, importes y relaciones.

El UUID de solicitud es único. El servidor guarda una huella SHA-256 del medio y de los productos/cantidades ordenados. Una repetición del mismo usuario y contenido devuelve la venta original; otro usuario o contenido recibe conflicto. Se comprueba también después de adquirir los bloqueos, para resolver dos reintentos simultáneos. La huella no contiene credenciales.

Cuando hay cliente, la forma canónica agrega `:customer=<id>`. Cambiar o quitar el cliente con el mismo requestId recibe 409. Para null se conserva exactamente la huella V3/V4, permitiendo reintentos históricos. Se consulta la referencia antes de validar la nueva asociación: un reintento confirmado devuelve su venta incluso si el cliente quedó inactivo después. En nuevas ventas se bloquea primero la fila de cliente, se vuelve a comprobar la referencia y luego se bloquean productos por ID; el cambio de estado del cliente usa el mismo bloqueo. Ningún flujo de Customer adquiere bloqueos de productos. Se mantienen transacción, rollback y protección de stock.

El frontend conserva esa referencia al fallar la red o recibir un resultado incierto, bloquea la edición y ofrece reintentar. No guarda el carrito ni JWT en almacenamiento persistente. Después de salir o recargar, hay que revisar el historial antes de repetir una operación incierta.

## Interfaz

`useSalesApi` centraliza HTTP mediante el cliente autenticado existente. `SalesPage` coordina catálogo paginado, búsqueda y carrito; `PosProducts`, `Cart`, `SaleConfirmation` y `SaleDetail` separan responsabilidades. `SalesHistoryPage` consulta listado y detalle. Las funciones puras de `cartState` validan cantidades y calculan la vista previa. Los DTO recibidos se validan antes de usarse.

Desktop muestra catálogo y carrito en columnas; móvil los apila y permite saltar al carrito con foco. Se mantienen tokens CajaLima, Inter local, controles táctiles, etiquetas, foco visible y mensajes asociados. El dashboard obtiene ventas y cantidad reales del resumen del servidor, con límites del día en Perú.

CustomerPicker busca clientes activos con consultas paginadas y cancelables; solo carga una página de 20, no todo el catálogo. Reutiliza CustomerForm para el alta rápida: el resultado se selecciona y conserva el carrito. Cambiar cliente renueva requestId; una respuesta incierta bloquea la selección/creación y conserva el mismo cliente hasta reintentar. Una venta confirmada limpia carrito y cliente. CustomerPurchaseHistory presenta compras reales paginadas en el diálogo del cliente y enlaza a `/app/sales/history?sale=<id>`; la página valida ese parámetro y usa el endpoint existente para el detalle.

No se implementan fiados, crédito, deuda, pagos parciales, descuentos, impuestos, anulaciones, devoluciones, reportes ni pasarelas. Las limitaciones de autenticación y despliegue del README siguen vigentes. Resultados y reproducción: [verificación](verification.md).
