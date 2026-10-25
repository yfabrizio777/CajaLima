# Fiados y saldos pendientes

V6 incorpora un ledger de `customer_account_movements`: CREDIT suma deuda y PAYMENT la reduce. No hay columna de saldo en Customer, ni operaciones de edición/borrado, ajustes, intereses, cuotas o saldo a favor. Todos los importes son positivos, hasta 999 999 999 999,99 y con máximo dos decimales. El saldo se deriva de SUM(CREDIT) − SUM(PAYMENT).

## Escritura e integridad

`POST /api/sales` admite `paymentMethod: CREDIT` («Fiado») únicamente con cliente activo y total positivo calculado por el servidor. Mantiene venta, snapshots, stock, movimiento SALE y movimiento financiero en una sola transacción. V6 amplía el constraint de medios sin alterar V1–V5. La FK compuesta del CREDIT comprueba venta, cliente, importe, autor y medio CREDIT; una venta normal no genera deuda. Un movimiento CREDIT único por venta y sin cascadas conserva la auditoría.

El orden de bloqueo es cliente y después productos por ID. CustomerAccountService participa obligatoriamente en la transacción de SaleService al registrar CREDIT. No importa clases ni servicios de Sale. El cliente se bloquea también al registrar pagos y cambiar estado. Así, dos pagos concurrentes leen el saldo resultante del anterior; no pueden aceptar conjuntamente más de lo pendiente. El control del saldo negativo se aplica en el servicio bajo ese bloqueo; no se permite escribir el ledger desde endpoints genéricos.

## API

Ambos roles ADMIN/EMPLOYEE pueden operar. No se admite acceso anónimo. La versión actual comparte un único negocio; no hay separación multiempresa.

| Ruta | Entrada / resultado |
| --- | --- |
| GET `/api/customers/{id}/account` | customerId, customerName, outstandingBalance, totalCredit, totalPaid, lastMovementAt |
| GET `/api/customers/{id}/account/movements?page=0&size=20` | items/total/page/size; máximo 100, orden fecha/id descendente; tipo, importe, venta de referencia, medio, nota, autor y fecha |
| POST `/api/customers/{id}/payments` | requestId UUID, amount, paymentMethod CASH/YAPE/PLIN/TRANSFER, note opcional hasta 240; devuelve movimiento, 201 |

El resumen expresa los tres importes como cadenas decimales exactas con dos posiciones; el frontend opera esos acumulados en céntimos BigInt. Cada movimiento conserva BigDecimal/NUMERIC y su importe individual acotado. No se redondean saldos usando Number ni se limita artificialmente la suma histórica a su precisión.

Un cliente inexistente recibe 404; inactivo o pago superior al saldo, 409. Cuenta e historial siguen consultables para inactivos, pero deben reactivarse para recibir pagos nuevos. El actor se obtiene del principal JWT, y no se aceptan balance, previousBalance, newBalance, createdBy ni tipo de movimiento enviado por el cliente. Notas con NUL o UTF-16 malformado son inválidas. Los errores internos no exponen SQL ni datos privados.

## Reintentos

El UUID del pago es globalmente único. Su huella SHA-256 incluye cliente, importe canónico, medio y nota normalizada; el actor se compara además. Reutilizar una referencia con distinto contenido/actor produce conflicto. Se comprueba antes y después del bloqueo del cliente, antes de validar el saldo/estado actual. Un reintento válido devuelve el mismo movimiento incluso si la deuda quedó saldada o el cliente fue desactivado después. La colisión concurrente entre clientes distintos se resuelve mediante el índice único y el manejador de integridad 409.

El diálogo guarda únicamente el intento pendiente —UUID, monto, medio y nota— en sessionStorage por actor autenticado y cliente, antes de enviar. No guarda JWT, saldo ni ficha del cliente. Ante respuesta incierta bloquea cambios y permite reintentar con la misma referencia; tras recargar y autenticar al mismo usuario, la cuenta ofrece «Comprobar pago pendiente», también si ya figura saldo cero. Conserva el intento ante expiración de sesión durante esa incertidumbre. Una confirmación o rechazo definitivo lo limpia. Cerrar la pestaña elimina ese almacenamiento: en otra pestaña se deben revisar movimientos antes de repetir una operación incierta.

## Interfaz

Fiado aparece en POS y en historial/detalle de ventas. Sin cliente se muestra «Selecciona un cliente para registrar una venta fiada.» y se bloquea el registro. La cuenta se muestra al comienzo del detalle de cliente: saldo, pago parcial/total y movimientos con signo +/− y texto, sin depender del color. No tiene saldo pendiente se representa como S/ 0.00. El diálogo de pago usa IDs accesibles únicos para convivir con el diálogo del cliente. Se mantienen los componentes, colores y tipografía de CajaLima.

No se incluyen Gastos/Compras, Reportes ni despliegue público. Los avisos de dependencias y el pentest Strix siguen siendo tareas separadas. Resultados: [verificación](verification.md).
