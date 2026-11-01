# Caja y contabilidad por partida doble

Módulo de caja (turnos, arqueo a ciegas, caja general, caja menor) con un libro contable de partida doble. Todo el dinero son **pesos COP enteros**; las fechas contables son el **día calendario de Bogotá** (`src/lib/shared/bogotaDate.ts`).

> Los datos de ejemplo en tests y documentación son ficticios. **Nunca** se prueba contra Firebase de producción: el entorno de desarrollo usa el mismo proyecto.

## 1. Objetivo y alcance

- Registrar cada cobro, devolución, retiro, consignación y gasto de caja como un **movimiento** con su **asiento contable** cuadrado.
- Cerrar turnos con **arqueo a ciegas** y aprobación de diferencias.
- Dar al contador un **plan de cuentas** y **reglas contables** editables, sin tocar código, y los libros (diario, mayor y balance de comprobación) con exportación a Excel/CSV.
- Quedan **fuera de alcance**: ver sección 9.

## 2. Arquitectura

### Capas

| Capa | Dónde | Responsabilidad |
|---|---|---|
| Motor contable puro | `src/lib/ledger/journal.helpers.ts`, `reports.helpers.ts` | Resolver reglas, armar y validar asientos, saldos y balance. Sin Firebase |
| Servicios del libro | `src/lib/ledger/*.server.ts` | Cuentas, reglas, asientos y reportes (Admin SDK) |
| Servicios de caja | `src/lib/cash/**` (incl. `petty/`) | Cajas, turnos, movimientos, cierres, caja general y caja menor |
| Rutas | `src/app/api/ledger/**`, `src/app/api/cash/**` | Autorización, validación (zod) y respuesta |
| UI | `src/features/ledger/**`, `src/features/cash/**` | Pantallas, hooks y servicios HTTP del cliente |

Las cajas **no conocen cuentas**: un movimiento le pide al motor un asiento y la **regla contable** vigente decide qué cuentas toca. Cambiar una regla no altera el pasado.

### Colecciones (`restaurants/{rid}/…`)

| Colección | Contenido |
|---|---|
| `ledgerAccounts` | Plan de cuentas. El código es inmutable |
| `accountingRules` | Reglas versionadas por evento y medio de pago (una vigente por combinación) |
| `journalEntries` / `journalLines` | Asientos y sus líneas aplanadas (cuenta, fecha, débito, crédito) para consultar por cuenta y fecha |
| `cashRegisters` | Cajas `REGISTRADORA`, `GENERAL`, `MENOR` y su cuenta contable |
| `cashShifts`, `cashShiftLocks` | Turnos y candados de unicidad (una caja y un cajero, un turno abierto) |
| `cashMovements` | Movimientos (con espejos de traslados) |
| `cashClosings` | Foto inmutable del cierre: esperado, contado, diferencias, aprobación |
| `cashRegisterBalances` | Saldo materializado por caja y medio |
| `cashSettings` | Denominaciones, cuenta por medio de pago, caja general por defecto |
| `pettyCashExpenses`, `pettyCashReimbursements`, `pettyCashCategories` | Caja menor |
| `sequences`, `idempotency`, `auditLog` | Consecutivos, llaves de idempotencia y bitácora |

### Transacciones e idempotencia

- Cada caso de uso corre en **una transacción** con dos fases: `prepare*` **solo lee** (reglas, cuentas, saldos, consecutivos) y `commit(tx)` **escribe al final**. Así un movimiento, su asiento, el saldo y la auditoría se confirman juntos o no se confirma nada.
- Toda operación que mueve dinero exige el header `Idempotency-Key`. La repetición con el mismo payload devuelve el resultado guardado; con otro payload se rechaza. El cliente genera **una llave por intención** (`useIdempotencyKey`).
- Los candados de turno se crean con `tx.create`: si ya existen, la transacción falla.

### Consecutivos

Sin huecos: el incremento y el documento que lo usa comparten transacción.

| Prefijo | Qué numera |
|---|---|
| `CC-000001` | Asientos contables |
| `RC-` | Recibos de caja (entradas) |
| `CE-` | Comprobantes de egreso |
| `TR-` | Traslados entre cajas, base de apertura, consignaciones, reposiciones |
| `RV-` | Reversos de movimientos |
| `VCM-` | Vales de caja menor |

### Saldos materializados y espejos

- `cashRegisterBalances/{registerId}` guarda el saldo por medio de pago. Se lee en la fase de lectura y se escribe con `tx.set`: dos egresos simultáneos no pueden gastar el mismo efectivo (Firestore detecta el conflicto). Se puede recalcular desde los movimientos para conciliar.
- Un traslado entre cajas genera un movimiento real en la caja origen y un **espejo** en la contraparte (`mirrorOfMovementId`, mismo número de comprobante). El espejo mantiene el saldo de la otra caja, pero **no cuenta en ningún turno** y los totales del restaurante lo excluyen.

### Auditoría

`auditLog` guarda quién, cuándo, desde dónde (IP, user agent) y sobre qué entidad. **Nunca** cuerpos de petición ni datos personales. Las respuestas al cliente omiten el bloque `audit`.

## 3. Reglas de negocio vigentes

### Defaults de operación

1. Dinero en pesos enteros; nunca decimales.
2. Día contable = día calendario de Bogotá del hecho real (no el de apertura del turno).
3. El cierre es **a ciegas**: el cajero cuenta por denominación sin ver esperado ni diferencias.
4. Diferencia dentro del **umbral** de la caja: el turno cierra solo. Fuera del umbral: queda pendiente y lo aprueba un supervisor (`cash.approve`) **distinto** del cajero.
5. Faltante aprobado: por defecto a **1365 cuentas por cobrar a trabajadores**; sobrante a **4295 ingresos diversos**. El supervisor puede elegir otra cuenta de faltante.
6. Al cerrar, el efectivo contado se **traslada a la caja general**.
7. Una caja registradora y un cajero solo pueden tener **un turno abierto** a la vez.
8. Cobro en efectivo exige turno propio abierto. Medios electrónicos van al turno propio o, si no tiene, a la caja general sin turno.
9. Los **retiros parciales** quedan pendientes hasta que otro usuario con `cash.approve` los aprueba.
10. Una devolución sale del **turno actual** de quien devuelve y no puede superar lo cobrado menos lo ya devuelto.
11. Un movimiento = un asiento. La regla vigente se elige por evento y medio de pago exacto; si no hay, la genérica.
12. Los asientos **no se editan**: se corrigen con un contra-asiento (reversión). Una reversión no se reversa.
13. Datáfono: lo vendido va a **1380 deudores varios - pasarelas**; la liquidación (D banco / C 1380) se registra aparte, sin comisiones.

### Decisiones del orquestador

- **Gate estricto de `features.cash`**: sin `planFeatures` que lo incluya, no hay acceso (solo el super admin). Un restaurante anterior al sistema de planes **no** pasa.
- `BASE_APERTURA` y `TRASLADO_CIERRE` se hacen **a través de la caja general** (la base sale de la general; al cierre el efectivo vuelve a ella).
- `REVERSO` de movimientos **solo en turnos abiertos o en cierre**; turno cerrado se corrige con una devolución.
- Los **retiros se aprueban por otro usuario**.
- `accountingDate` = fecha real de Bogotá del movimiento.
- El **candado del cajero se libera** cuando su cierre queda pendiente de aprobación (puede abrir otro turno).
- La **caja menor se reconoce contablemente al reembolsar**, no al registrar el gasto: un asiento `PETTY_CASH_EXPENSE` por vale y uno de reposición por el total, en una sola transacción.
- Máximo **80 gastos por reembolso** (`MAX_REIMBURSEMENT_EXPENSES`): cabe en el límite de 500 escrituras de Firestore.
- Las cuentas de caja menor y de gasto de las reglas `PETTY_CASH_*` salen de la **cuenta contable de la caja menor** y de la categoría del gasto, no de un código fijo.

## 4. Plan de cuentas semilla (a validar por el contador)

Se crea con **Inicializar plan de cuentas** (`POST /api/ledger/setup`, idempotente). Todo se marca *a validar por el contador*. El único lugar con códigos es `src/lib/ledger/seed.ts`.

| Código | Cuenta | Clase | Admite movimientos |
|---|---|---|---|
| 1105 | Caja | Activo | No (agrupación) |
| 110505 | Caja general | Activo | Sí |
| 110510 | Cajas menores | Activo | Sí |
| 1110 | Bancos | Activo | Sí |
| 1365 | Cuentas por cobrar a trabajadores | Activo | Sí |
| 1380 | Deudores varios - pasarelas de pago | Activo | Sí |
| 2408 | IVA por pagar | Pasivo | Sí |
| 4140 | Hoteles y restaurantes | Ingreso | Sí |
| 4175 | Devoluciones en ventas | Ingreso (naturaleza débito) | Sí |
| 4295 | Ingresos diversos - sobrantes | Ingreso | Sí |
| 5195 | Gastos diversos | Gasto | Sí |

Las cajas registradoras y el patrimonio inicial se crean con cuentas propias (p. ej. `110515 Caja registradora 1`, `3115 Aportes`).

### Preguntas abiertas para el contador

1. **4140 vs 4135**: ¿las ventas de restaurante van a 4140 (hoteles y restaurantes) o a 4135 (comercio)?
2. **Impoconsumo / IVA**: hoy la venta se registra por el total sin desglosar impuestos. ¿Cómo se quiere separar (2408, impoconsumo)?
3. **VCM vs CE**: ¿el vale de caja menor debe seguir su propio consecutivo o unificarse con el comprobante de egreso?
4. **1380 para pasarelas**: ¿es la cuenta correcta para lo pendiente de liquidar por datáfono y otros medios?
5. **5195 por defecto**: ¿gastos diversos es el destino correcto de un egreso sin categoría?

## 5. Permisos

| Permiso | Requiere | Qué permite |
|---|---|---|
| `features.cash` | (plan) | Habilita el módulo para el restaurante |
| `ledger.view` | `features.cash` | Ver libros, plan de cuentas y reglas |
| `ledger.manage` | `ledger.view` | Crear/editar cuentas y reglas, reversar asientos |
| `ledger.export` | `ledger.view` | Exportar libros a Excel/CSV |
| `cash.view` | `features.cash` | Ver cajas, turnos y movimientos |
| `cash.operate` | `cash.view` | Abrir/cerrar turno, cobrar, ingresos y egresos |
| `cash.approve` | `cash.view` | Aprobar cierres y retiros, caja general, **reportes de caja** |
| `cash.reverse` | `cash.view` | Reversar movimientos de caja |
| `cash.registers.manage` | `cash.view` | Administrar cajas y configuración de caja |
| `petty_cash.manage` | `cash.view` | Operar caja menor; reporte de estado de caja menor |
| `petty_cash.approve` | `petty_cash.manage` | Aprobar legalizaciones y reembolsos |

### Pantallas y rutas

| Ruta | Permiso |
|---|---|
| `/dashboard/libros` (diario), `/mayor`, `/balance`, `/plan-de-cuentas`, `/reglas` | `ledger.view` |
| `/dashboard/caja/reportes` | `cash.approve` |
| `/dashboard/caja/*` (turno, aprobaciones, general, menor, configuración) | Ver `ROUTE_PERMISSIONS` |

Las pantallas del libro usan `LedgerModuleGate`: exigen permiso pero **no** que la caja esté activada, para que el contador prepare cuentas y reglas antes de activar.

### API de reportes

| Ruta | Permiso |
|---|---|
| `GET /api/ledger/journal?from&to&cursor&limit` (límite máx. 200) | `ledger.view` |
| `GET /api/ledger/ledger?accountId&from&to` (máx. 2000 líneas, `truncated`) | `ledger.view` |
| `GET /api/ledger/trial-balance?from&to` | `ledger.view` |
| `GET /api/cash/reports/shifts/[shiftId]` | `cash.approve` |
| `GET /api/cash/reports/daily?date=YYYY-MM-DD` | `cash.approve` |
| `GET /api/cash/reports/petty?registerId&from&to` | `petty_cash.manage` |

Reglas de los reportes:

- **Libro mayor**: saldo inicial = Σ(débito − crédito) de las líneas anteriores a `from` (agregación `sum` de Firestore); el saldo corrido usa el signo de la naturaleza de la cuenta (`DEBITO`: D−C, `CREDITO`: C−D). Los totales y el saldo final salen de agregaciones, así que son correctos aunque se trunquen las líneas.
- **Balance de comprobación**: Σ débitos = Σ créditos del período y los saldos netos suman cero.
- **Resumen diario**: movimientos `APLICADO` de la fecha. Cada caja incluye sus espejos (marcados aparte); **los totales del restaurante los excluyen**.
- **Exportación**: client-side. CSV en UTF-8 con BOM, separador coma, comillas escapadas y protección contra inyección de fórmulas (celdas de texto que empiezan con `=`, `+`, `-`, `@` llevan `'` delante; los números, incluidos los negativos, no).

## 6. Activación por restaurante

1. Habilitar `features.cash` en el **plan** del restaurante.
2. Otorgar permisos a los usuarios (ver sección 5).
3. **Inicializar plan de cuentas** (`/dashboard/libros/plan-de-cuentas`). El contador revisa cuentas y reglas.
4. Crear las cajas: una **GENERAL**, una o más **REGISTRADORA** y, si aplica, una **MENOR** (cada una con su cuenta contable; el fondo de la menor se constituye después).
5. Cargar el **saldo inicial de la caja general** con una contrapartida (p. ej. patrimonio), nunca sin contrapartida.
6. **Mapear medios de pago** a cuentas (banco, pasarela) en la configuración de caja.
7. **Activar** el módulo (`cashModuleEnabled`). Hasta entonces los cobros siguen funcionando como siempre y no se usan turnos.

## 7. Orden de despliegue

1. **Código** (el servidor ya sabe leer y escribir las colecciones nuevas).
2. **Índices** (`firebase deploy --only firestore:indexes`). Esperar a que terminen de construirse.
3. **Reglas** (`firestore.rules`; el archivo es CRLF).

**Nunca activar un restaurante antes de que los índices estén construidos**: los reportes y los listados fallan con `FAILED_PRECONDITION` mientras se construyen. Este repositorio no despliega nada automáticamente.

## 8. Testing

```bash
npm test                         # todo
npx vitest run src/__tests__/ledger src/__tests__/cash
npm run lint
npx tsc --noEmit
```

| Qué | Dónde |
|---|---|
| Motor contable puro | `src/__tests__/ledger/journal.helpers.test.ts`, `reports.helpers.test.ts` |
| Servicios del libro y reportes | `ledger.server.test.ts`, `reports.server.test.ts` (día realista de `reportsFixture.ts`) |
| Rutas (401/403, permiso exacto, validación) | `ledger.routes.test.ts`, `reports.routes.test.ts`, `cash.routes.test.ts` |
| Exportación (escape, inyección, BOM, filas) | `export.test.ts` |
| Flujos de caja completos | `src/__tests__/cash/cash.e2e.test.ts`, `petty/petty.e2e.test.ts` |
| Reportes de caja | `src/__tests__/cash/cash.reports.test.ts` |
| UI (plan, reglas, libro diario, sidebar) | `ledger.ui.test.tsx`, `ledger.nav.test.tsx`, `cash/ui/*` |

Los tests usan un **Firestore en memoria** (`src/__tests__/orders/fakeFirestore.ts`, con filtros de rango, `orderBy`, `startAfter` y agregaciones `sum`/`count`). **No hay emulador** y nunca se corre contra producción. El fake no replica las reglas de seguridad ni los índices: un índice faltante solo se descubre en un entorno real. Archivo con falla conocida y ajena: `src/__tests__/components/CartDrawer.test.tsx`.

## 9. Limitaciones conocidas y fuera de alcance

- **DIAN**: sin facturación electrónica ni documentos soporte.
- **Propinas**: sin tratamiento propio.
- **Impuestos desglosados**: la venta se asienta por el total; IVA e impoconsumo no se separan.
- **Comisiones de pasarela**: la liquidación del datáfono no registra comisiones ni retenciones (las asienta el contador aparte).
- **Cierre a ciegas**: falta una pista que ayude a justificar diferencias grandes antes de enviarlas.
- **Contadores de estado a escala**: los conteos de la caja menor se calculan leyendo los gastos de la caja; con volúmenes muy altos habrá que materializarlos.
- **Balance de comprobación**: hace dos agregaciones por cuenta con movimientos; es adecuado para un plan de cuentas pequeño.
- **Libro diario**: la exportación incluye solo los asientos ya cargados en pantalla.
- **Sin pruebas con emulador** de Firestore: la concurrencia real se simula en memoria con control optimista de versiones.
