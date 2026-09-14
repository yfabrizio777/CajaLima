# Productos e inventario

Monolito modular, package-by-feature `product/{domain,repository,dto,service,controller}`. Inventario permanece en este módulo porque la operación y el movimiento comparten una transacción. No hay ventas, compras ni integraciones nuevas.

## Datos y reglas

`V2__crear_productos_e_inventario.sql` crea únicamente `products` e `inventory_movements`. V1 permanece intacta. V2 ya está aplicada en el entorno local: cualquier cambio posterior de esquema requiere una migración nueva.

`products`: id BIGSERIAL; nombre obligatorio hasta 160 caracteres; SKU opcional hasta 64, normalizado a mayúsculas sin espacios externos y único incluso en productos inactivos; precio de venta obligatorio y costo opcional NUMERIC(10,2)/BigDecimal; stock y stock mínimo enteros entre 0 y 1 000 000; estado activo; fechas de creación/actualización TIMESTAMPTZ/Instant. SKU vacío se convierte en NULL. Se admiten letras ASCII, números, punto, guion y guion bajo. Dinero entre 0 y 99 999 999.99, máximo dos decimales.

`inventory_movements`: id BIGSERIAL, product_id FK products, tipo INITIAL/ADJUSTMENT, quantity con signo, previous_stock, new_stock, motivo obligatorio hasta 240 caracteres, created_by FK users y created_at TIMESTAMPTZ. PostgreSQL exige `quantity = new_stock - previous_stock`, stocks no negativos y movimiento no nulo. INITIAL requiere stock previo cero y nuevo positivo. No hay borrado físico de productos en la API ni edición/eliminación del histórico.

Crear con stock positivo registra INITIAL. Ajustar exige un stock nuevo diferente y un motivo. El servicio toma el stock anterior desde la fila bloqueada, calcula la diferencia y obtiene el autor del principal autenticado. La actualización y el movimiento se confirman juntos. Dos ajustes concurrentes se serializan por producto: el segundo parte del resultado del primero; queda la cadena completa. Cada ajuste expresa una cantidad final absoluta, no un incremento acumulativo.

`lowStock` deriva de `stock <= minimumStock`; no se almacena. El resumen cuenta productos activos y productos activos con poco stock. Los inactivos mantienen su historial y se pueden reactivar.

## API

Todas las rutas exigen Bearer JWT. ADMIN y EMPLOYEE leen el catálogo compartido del mismo negocio; no existe aislamiento multiempresa en esta versión. ADMIN es el único autorizado a escribir mediante `@PreAuthorize` en el servicio.

| Método y ruta | Entrada / resultado |
| --- | --- |
| GET `/api/products` | search, active, lowStock, page (desde 0), size (1–100, default 20); devuelve items, total, page, size |
| GET `/api/products/{id}` | Producto completo |
| GET `/api/products/summary` | activeProducts, lowStockProducts |
| POST `/api/products` | name, sku?, salePrice, costPrice?, initialStock, minimumStock, active; 201 |
| PUT `/api/products/{id}` | name, sku?, salePrice, costPrice?, minimumStock; no stock ni estado |
| PATCH `/api/products/{id}/status` | active |
| POST `/api/products/{id}/stock-adjustments` | newStock, reason |

Respuesta: id, name, sku, salePrice, costPrice, stock, minimumStock, lowStock, active, createdAt, updatedAt. Errores conservan ApiError: 400 datos inválidos, 401 sin autenticación, 403 sin permiso, 404 inexistente y 409 conflicto de SKU. Búsqueda parametrizada, sin distinguir mayúsculas, con `%` y `_` tratados literalmente; orden estable por nombre e id. No se aceptan campos desconocidos ni histórico enviado por el cliente.

## Frontend y UX

`ProductsPage` coordina consulta paginada y filtros, `ProductList` muestra tabla/tarjetas según viewport, `ProductForm` edita datos y `StockForm` ajusta existencias. `Dialog` usa el diálogo modal nativo con foco y cierre Escape. Se reutilizan Field, utilidades es-PE y tokens visuales. `products/api.ts` concentra las operaciones y usa `authenticatedRequest` del AuthProvider; no expone el token a componentes ni añade almacenamiento persistente.

Los errores de campos se vinculan con sus inputs y el primer error recibe foco. Poco stock siempre tiene texto. Las acciones administrativas no se muestran a EMPLOYEE; el backend también las rechaza. El listado diferencia vacío inicial, búsqueda sin resultados, carga y error recuperable.

Refinamientos: contenido limitado a 1440 px, logo sidebar ligeramente mayor, ilustración de login acotada, mensaje de recarga orientado al usuario y enlace de setup visible solo cuando el endpoint existente confirma disponibilidad. El KPI destacado es Productos; ventas muestra «—» y «Módulo próximamente».

Graphify verificó ProductsPage/StockForm → useProductsApi y ProductController → ProductService → ProductRepository, además de ProductService → InventoryMovementRepository. El enlace HTTP entre frontend y backend y la persistencia PostgreSQL se verificaron en las pruebas reales; no se presentan como aristas que Graphify haya extraído entre lenguajes.
