# Promociones, clientes y fidelidad

Módulo para que el restaurante **mueva días flojos, suba el ticket promedio, saque inventario y traiga clientes nuevos o que vuelvan**.

## Fase 0 — Base: el precio lo calcula el servidor

Antes, el menú público creaba el pedido directo en Firestore (`allow create: if true`) con los precios que mandaba el navegador. Cualquiera podía guardar un pedido con la hamburguesa a $1.

Ahora:

| Antes | Ahora |
|---|---|
| `CartDrawer` → `ordersService.create()` (cliente) | `CartDrawer` → `POST /api/orders` (servidor, Admin SDK) |
| El navegador manda precios y totales | El navegador manda **qué** pidió (productos, cantidades, ids de adicionales, entrega, pago) |
| Regla `create: if true` | Regla `create` solo con `orders.create` (pedidos manuales del panel) |

`src/lib/orders/createOrder.server.ts`:

1. Carga el restaurante (activo, no suspendido, con `applyPlanFeatures`).
2. Lee precios reales de productos y adicionales (por id; por nombre para carritos viejos).
3. Valida: producto activo y disponible, adicional permitido, zona/mesa existente, método de pago permitido para la forma de entrega, fecha programada razonable.
4. Evalúa promociones con el **mismo motor** que la vista previa del carrito, en hora de Colombia.
5. Guarda en **una transacción**: pedido + `usesCount` de cada promoción + registro del cliente. La transacción vuelve a leer los límites (`maxUses`, primer pedido, usos por cliente) para que dos pedidos simultáneos no usen la "última unidad".
6. Devuelve el pedido calculado; el carrito arma el mensaje de WhatsApp con esos números.

Si el servidor rechaza el pedido (agotado, cupón vencido…) el carrito muestra el motivo y **no** abre WhatsApp. Si no hay conexión o el servidor falla (5xx), se envía igual por WhatsApp sin número de orden (comportamiento anterior).

Rutas públicas (sin sesión):

| Ruta | Para qué |
|---|---|
| `POST /api/orders` | Crear el pedido |
| `POST /api/promotions/coupon` | Validar un cupón para la vista previa (las promociones con cupón nunca se envían al menú: se revelaría el código) |
| `POST /api/customers/status` | Con el celular: ¿cliente nuevo? ¿cuántos sellos lleva? Solo devuelve contadores |

### Clientes (`restaurants/{id}/customers/{telefono}`)

- La identidad es el **teléfono normalizado** (`src/lib/customers/phone.ts`): `300 123 4567`, `+57 3001234567` y `573001234567` → `3001234567`.
- El pedido guarda `customerPhoneKey`. Los pedidos manuales del panel también.
- Lo escribe **solo el servidor**: pedidos, primer y último pedido, usos por promoción, autorización de datos (Ley 1581) y último canje de fidelidad.
- Pedidos de antes de este cambio: se reconoce al cliente buscando las formas comunes de escribir el número (`phoneVariants`).

**Es una identidad débil**: cualquiera puede escribir el número de otro. Por eso los descuentos de entrada (primer pedido, 1 por cliente) deben ser moderados, y los pedidos con canje llegan etiquetados para que el restaurante los confirme por WhatsApp.

## Tipos de promoción

| Tipo | Ejemplo | Plan |
|---|---|---|
| `item_discount` — precio tachado | 20% en pizzas, hamburguesa a $19.900 | `features.promotions` |
| `order_discount` — descuento al total | $5.000 menos desde $50.000 | `features.promotions` |
| `free_delivery` — domicilio gratis | gratis desde $40.000 | `features.promotions` |
| `bundle` — NxM | 2x1, 3x2 | `features.promotions_advanced` |
| `combo` — precio fijo | hamburguesa + papas + gaseosa = $28.000 | `features.promotions_advanced` |
| `gift` — regalo con la compra | gaseosa gratis desde $35.000 | `features.promotions_advanced` |

Condiciones de cualquier promoción: fechas, días de la semana, franja horaria (puede cruzar la medianoche), pedido mínimo, formas de entrega y límite total de usos.
Condiciones avanzadas: **cupón**, **solo primer pedido**, **usos por cliente**.

## Reglas de negocio (motor: `src/features/promotions/engine/engine.ts`)

1. **Una unidad, un descuento por producto.** Si una hamburguesa está en 2x1 y en 10%, se aplica la promoción que más ahorra al cliente; las unidades usadas no reciben otro descuento por producto.
2. **Descuento al total: solo el mejor.** Si no es "acumulable", no descuenta sobre productos que ya tienen precio tachado, 2x1 o combo.
3. **Fidelidad, domicilio gratis y regalos** se suman a lo anterior.
4. **Pedido mínimo**: se compara con los productos después de los descuentos por producto (lo que de verdad paga el cliente).
5. **Hora del restaurante**: `America/Bogota`, no la del navegador ni la del servidor (Vercel corre en UTC).
6. **Gracia**: si una promoción vence mientras el cliente arma el carrito, se respeta hasta 10 minutos después **si el cliente la vio aplicada** (`expectedPromotionIds`).
7. **Redondeo**: los descuentos en % se redondean a $50.
8. **Adicionales**: se cobran completos; los descuentos se calculan sobre el precio base del producto.

## Fidelidad (`restaurant.loyalty`)

"Cada N pedidos, un premio" (% con tope o monto fijo; 100% + tope = "pedido gratis hasta $X").

- **Sellos** = pedidos del cliente marcados como **Entregado** o **Pagado**, desde su último canje (y con el mínimo configurado). Un pedido falso que nunca se entregó no suma.
- El canje se pide en el carrito; el servidor revalida los sellos. El pedido llega con la etiqueta 🎁 *Canje de fidelidad*.
- Al canjear, los sellos vuelven a cero.

## Dónde se ve

- **Menú**: banner de promociones activas (los combos se agregan con un toque), badge y precio tachado en cada producto, categoría virtual "🔥 Promociones".
- **Carrito**: precio tachado por línea, regalos, "Te faltan $X para…", cupón, sellos de fidelidad, autorización de datos y desglose del total.
- **Pedido** (tarjeta, detalle, ticket impreso, WhatsApp): descuentos por línea, promociones aplicadas, cupón, domicilio gratis y regalos.
- **Contabilidad**: ventas brutas → descuentos → netas, y ranking de promociones (pedidos, ventas y costo). El Excel incluye productos, descuentos, domicilio y promociones.
- **Panel → Promociones**: asistente por pasos (tipo → descuento → cuándo → condiciones → cómo se ve), estados (Activa, Fuera de horario, Programada, Pausada, Vencida, Agotada), pausar, duplicar, editar, eliminar y configuración de fidelidad.

Cada pedido guarda una **foto** de las promociones aplicadas (`appliedPromotions`, `discount`, `items[].discount`): si después editan o borran la promoción, el pedido sigue mostrando lo que se cobró.

Montos del pedido: `total = subtotal − discount + deliveryFee` (`getOrderTotals`).

## Permisos

| Permiso | Qué permite |
|---|---|
| `features.promotions` | Plan: promociones básicas |
| `features.promotions_advanced` | Plan: combos, 2x1, regalos, cupones, primer pedido y fidelidad |
| `promotions.view` | Ver el módulo |
| `promotions.manage` | Crear, editar, pausar y eliminar; configurar fidelidad |

`firestore.rules`: `promotions` solo con permisos (el menú las recibe filtradas del servidor); `usesCount` no se puede cambiar desde el cliente; `customers` no se escribe desde el cliente; el campo `loyalty` del restaurante exige `promotions.manage`.

## Despliegue (en este orden)

1. **Desplegar el código** (Vercel). El menú nuevo ya crea pedidos por `/api/orders`.
2. **Publicar las reglas**: `firebase deploy --only firestore:rules --project antojoapp-30b81`.
   Si se publican antes que el código, el menú viejo no podrá guardar pedidos (seguiría enviando WhatsApp sin número de orden).
3. **Super admin → Planes**: marcar *Promociones* (y *Promociones avanzadas y fidelidad* donde aplique) y los permisos `promotions.*` del rol. Al guardar el plan se sincronizan los permisos de los restaurantes y usuarios.
   Los restaurantes **sin plan** tienen todo habilitado.

## Pendiente / ideas

- Límite de solicitudes por IP en las rutas públicas (hoy no hay rate limiting).
- Verificación del celular por código (WhatsApp/SMS) si el abuso de "primer pedido" se vuelve un problema real.
- Lista de clientes con autorización de datos para campañas por WhatsApp.
- Aplicar promociones a los pedidos manuales del panel (hoy se crean a precio de lista).
