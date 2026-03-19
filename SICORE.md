# SICORE — Sistema de Retenciones de Ganancias AFIP

> Documentación técnica completa del módulo SICORE implementado en Control Presupuestario v1.1.
>
> **Última actualización**: 2026-03-19
> **Commit base**: `5e7533a` (Cierre v2 carga automática)

---

## 1. Introducción

SICORE (Sistema de Control de Retenciones) es el módulo que gestiona la **retención de Impuesto a las Ganancias** sobre pagos a proveedores, según normativa AFIP.

Se intercepta automáticamente al cambiar el estado de una factura/anticipo a `'pagar'` y, si corresponde retención, abre un modal interactivo donde el operador confirma el tipo y el monto.

---

## 2. Estructura de Base de Datos

### 2.1. Tabla de configuración: `tipos_sicore_config`

```sql
CREATE TABLE tipos_sicore_config (
  id                   SERIAL PRIMARY KEY,
  tipo                 VARCHAR(50)   NOT NULL,  -- 'Arrendamiento', 'Bienes', 'Servicios', 'Transporte'
  emoji                VARCHAR(10)   NOT NULL,
  minimo_no_imponible  DECIMAL(15,2) NOT NULL,
  porcentaje_retencion DECIMAL(5,4)  NOT NULL,
  activo               BOOLEAN       DEFAULT true
);
```

**Registros actuales:**

| Tipo          | Emoji | Mínimo no imponible | % Retención |
|---------------|-------|---------------------|-------------|
| Arrendamiento | 🏠    | $134,400.00         | 6.00%       |
| Bienes        | 📦    | $224,000.00         | 2.00%       |
| Servicios     | 🔧    | $67,170.00          | 2.00%       |
| Transporte    | 🚛    | $67,170.00          | 0.25%       |

### 2.2. Columnas SICORE en `msa.comprobantes_arca`

```sql
ALTER TABLE msa.comprobantes_arca
  ADD COLUMN sicore              VARCHAR(20),    -- Ej: '26-03 - 2da'
  ADD COLUMN monto_sicore        DECIMAL(15,2),  -- Monto retención en pesos
  ADD COLUMN tipo_sicore         VARCHAR(50),    -- 'Servicios', 'Arrendamiento', etc.
  ADD COLUMN descuento_aplicado  DECIMAL(15,2),  -- Descuento adicional si se aplicó
  ADD COLUMN tc_pago             DECIMAL(15,4);  -- TC de pago para facturas USD

-- Índice de performance para queries quincena
CREATE INDEX idx_sicore_performance ON msa.comprobantes_arca (sicore, cuit);
```

### 2.3. Columnas SICORE en `anticipos_proveedores`

```sql
-- Las mismas columnas están también en anticipos:
sicore           VARCHAR(20)
monto_sicore     DECIMAL(15,2)
tipo_sicore      VARCHAR(50)
factura_id       UUID  -- Vínculo a la factura (para cierre quincena)
cuit_proveedor   VARCHAR(20)
```

---

## 3. Cálculo de Quincena

```typescript
const generarQuincenaSicore = (fechaVencimiento: string): string => {
  const fecha = new Date(fechaVencimiento)
  const año   = fecha.getFullYear().toString().slice(-2)  // '26'
  const mes   = (fecha.getMonth() + 1).toString().padStart(2, '0')  // '03'
  const dia   = fecha.getDate()
  const quincena = dia <= 15 ? '1ra' : '2da'
  return `${año}-${mes} - ${quincena}`  // '26-03 - 1ra' o '26-03 - 2da'
}
```

**Regla:** La quincena se determina por `fecha_vencimiento` (o `fecha_estimada` como fallback):
- Días 1–15 → `YY-MM - 1ra`
- Días 16–fin de mes → `YY-MM - 2da`

**Importante:** Si se cambia la fecha de pago antes de confirmar el estado `pagar`, la quincena se recalcula automáticamente con la nueva fecha. Al marcar como `pagado`, si la fecha difiere de la que se usó originalmente para calcular la quincena, el sistema corrige el campo `sicore` en la BD.

---

## 4. Umbral de Evaluación

El sistema usa el **mínimo más bajo** de todos los tipos como filtro inicial:

```
minimoServicios = $67,170 (Servicios y Transporte)
```

Si `neto_factura_pesos <= $67,170` → no abre modal, guarda el cambio directamente.

Si `neto_factura_pesos > $67,170` → abre modal para seleccionar tipo y confirmar.

Una vez seleccionado el tipo, se aplica el mínimo específico de ese tipo (que puede ser mayor, ej: Arrendamiento $134,400).

---

## 5. Fórmula Base SICORE

```
neto_factura  = imp_neto_gravado + imp_neto_no_gravado + imp_op_exentas
neto_en_pesos = neto_factura × tc_pago  (= 1 para facturas ARS)
```

**Primera retención en la quincena (mismo CUIT):**
```
base_imponible = neto_en_pesos - minimo_no_imponible_del_tipo
retencion      = base_imponible × porcentaje_retencion
```

**Retención adicional (CUIT ya retuvo en esa quincena):**
```
base_imponible = neto_en_pesos  (sin descontar mínimo)
retencion      = base_imponible × porcentaje_retencion
```

**Saldo final a pagar:**
```
monto_a_abonar = imp_total - retencion - descuento_adicional
```
Para facturas USD, `monto_a_abonar` se guarda en la moneda original:
```
monto_a_abonar_usd = (imp_total_pesos - retencion - descuento) / tc_pago
```

---

## 6. Flujo SICORE desde Egresos/Pagos (vista-facturas-arca.tsx)

### 6.1. Cambio de estado individual (modo inline)

1. Usuario edita el campo `estado` de una factura y escribe `'pagar'`.
2. El hook `useSicoreInline` detecta si el estado anterior era distinto de `'pagar'`.
3. Se intercepta el guardado: se actualiza `estado = 'pagar'` en BD y UI, pero se guarda la info en `guardadoPendiente`:
   ```typescript
   guardadoPendiente = { facturaId, columna: 'estado', valor: 'pagar', estadoAnterior }
   ```
4. Se llama a `evaluarRetencionSicore(factura)`.
5. Según el resultado:
   - **No corresponde** (Factura C tipo 11, negativa sin previa, o bajo mínimo): `ejecutarGuardadoPendiente()` finaliza el guardado en `facturasOriginales`.
   - **Sí corresponde**: abre el modal SICORE (`mostrarModalSicore = true`).

### 6.2. Modal Pagos — cambio de estado en lote (cambiarEstadoSeleccionadas)

El Modal de Pagos (`mostrarModalPagos`) permite seleccionar múltiples facturas y cambiar su estado en batch.

**Flujo al cambiar a `'pagar'`:**

1. **TC de pago (USD)**: si alguna factura es USD y no tiene `tc_pago`, se abre primero el modal de TC. Todas las USD sin TC forman una `colaUSDSinTC`. Solo cuando todas tienen TC se continúa.

2. **Evaluación SICORE**: se filtran las facturas que calificaron (`neto > $67,170`) y estaban en estado `pendiente`. Se pide confirmación al usuario mostrando la lista.

3. **Facturas sin SICORE**: se actualiza BD directamente en bloque.

4. **Cola SICORE**: la primera factura que califica se procesa con `evaluarRetencionSicore()`. Las restantes se guardan en `colaSicore`. Cuando el modal SICORE confirma o cancela para la primera, `procesarSiguienteSicore()` toma la siguiente.

5. **procesarSiguienteSicore()**:
   - Toma el primer elemento de `colaSicore`.
   - Actualiza `estado = 'pagar'` en BD (incluyendo fechas si corresponde).
   - Llama a `evaluarRetencionSicore()`.
   - Al terminar toda la cola, recarga las facturas del modal.

**Nota sobre fechas en la cola**: cuando el usuario seleccionó una `fechaPagoSeleccionada`, cada factura de la cola también recibe esa fecha (`fecha_vencimiento` + `fecha_estimada`). Esto afecta el cálculo de quincena.

### 6.3. Exclusiones y casos especiales

| Caso | Comportamiento |
|------|----------------|
| Factura C (tipo_comprobante = 11) | No retiene. `ejecutarGuardadoPendiente()` inmediato. |
| Factura ya estaba en estado `'pagar'` | No evalúa (hook solo dispara en transiciones hacia `'pagar'`). |
| Neto ≤ $67,170 | No abre modal. Guarda directamente. |
| Factura negativa, sin retención previa en quincena | No retiene. |
| Factura negativa, CON retención previa en quincena | Sí abre modal (retención negativa = devolución). |
| Factura USD sin TC de pago | Abre modal de TC primero; al confirmar TC, evalúa SICORE. |

---

## 7. Flujo SICORE desde Cash Flow (vista-cash-flow.tsx)

### 7.1. Cambio individual (Shift+Click → confirmar en modal)

1. Usuario cambia estado de una fila ARCA a `'pagar'` en el modal de confirmación.
2. `cambiarEstado()` detecta si corresponde SICORE.
3. Se guarda un `PendingSicore`:
   ```typescript
   type PendingSicore = { filaId: string, nuevoEstado: string, estadoAnterior: string }
   const pending: PendingSicore = { filaId, nuevoEstado: 'pagar', estadoAnterior }
   setGuardadoPendienteCF(pending)
   ```
4. Se llama a `evaluarRetencionSicoreCF(fila, pending, [])` — los parámetros `pending` y `freshCola` se pasan explícitamente para **evitar stale closure** (ver sección 11).
5. Resultado:
   - **No corresponde** → `cancelarSicoreCF(true, pending, [])` guarda el estado en BD.
   - **Sí corresponde** → abre el modal SICORE.

### 7.2. Lote PAGOS desde Cash Flow

El botón "PAGOS" en Cash Flow filtra filas ARCA con estado `pendiente` y las coloca en `aplicarCambiosLote()`.

1. Se separan filas que califican para SICORE (neto_pesos > $67,170).
2. Las que no califican se actualizan en batch.
3. La primera que califica se envía a `evaluarRetencionSicoreCF(primera, firstPending, resto)`.
4. El resto queda en `colaLoteSicore`.
5. Al confirmar/cancelar cada una, `finalizarProcesoSicoreCF()` o `cancelarSicoreCF()` avanzan la cola.

### 7.3. Diferencias con la implementación en Egresos/Pagos

| Aspecto | Egresos/Pagos | Cash Flow |
|---------|--------------|-----------|
| Verificación retención previa | Solo `comprobantes_arca` | Solo `comprobantes_arca` |
| Descuento adicional | Sí (con desglose proporcional) | No implementado |
| `monto_a_abonar` USD | `saldoPesos / tc` | `saldoPesos / tc` |
| Cola SICORE | `colaSicore` + `procesarSiguienteSicore()` | `colaLoteSicore` + avance en `finalizarProcesoSicoreCF()` |
| Cancelación | `cancelarGuardadoPendiente()` | `cancelarSicoreCF()` |
| Estado inicial intercepción | Antes del guardado real | Con stale closure fix (fresh params) |

### 7.4. Filas agrupadas (grupo_pago_id)

Las filas agrupadas en Cash Flow tienen `imp_neto_gravado: 0` hardcodeado (en `useMultiCashFlowData.ts` línea 158). Por lo tanto, **SICORE nunca evalúa para el ID de grupo** — solo para los IDs de las facturas individuales que lo componen. Esto es correcto: la retención se aplica por factura, no por agrupación.

---

## 8. Modal SICORE — Pasos

### Paso 1: Selección de tipo (`pasoSicore = 'tipo'`)

Muestra los 4 botones con tipo, emoji, mínimo y porcentaje. Al hacer clic en un tipo, se llama a `calcularRetencionSicore(factura, tipo)`.

### Paso 2: Confirmación del cálculo (`pasoSicore = 'calculo'`)

Muestra:

```
Factura:  PROVEEDOR EJEMPLO
Total:    $3.372.442,24
Neto:     $2.787.142,33
Mínimo:   $67.170,00  (se descuenta en primera retención)
Base:     $2.720.000,33
%:        2.00% (Servicios)
Retención:$55.742,85
Saldo:    $3.316.699,39
```

Si el CUIT ya tiene retención en esta quincena, se muestra aviso "Retención adicional — sin descuento de mínimo".

**Botones disponibles:**

| Botón | Acción |
|-------|--------|
| ✅ Confirmar SICORE | `finalizarProcesoSicore()` — actualiza BD y avanza cola |
| ↩️ Cambiar tipo | Vuelve al Paso 1 |
| 💰 Descuento adicional | Muestra input descuento (ver sección 9) |
| ⏭️ Continuar sin retención | `cancelarGuardadoPendiente(true)` — guarda `'pagar'` sin SICORE |
| ✕ Cancelar | `cancelarGuardadoPendiente(false)` — revierte al estado anterior |

---

## 9. Descuento Adicional

### 9.1. Funcionamiento (solo en Egresos/Pagos)

El operador puede aplicar un descuento antes de confirmar la retención. Se ingresa como:
- **Porcentaje** (ej: `5%` → descuenta el 5% del total)
- **Monto fijo** (ej: `50000` → descuenta $50.000)

### 9.2. Desglose proporcional (`aplicarDescuentoSicore`)

El descuento se descompone proporcionalmente entre los componentes de la factura:

```typescript
const pct = modoDescuento === 'pct' ? inputNum/100 : inputNum/impTotal

descGravado  = imp_neto_gravado  × pct
descIva      = iva               × pct
descNoGravado= imp_neto_no_gravado × pct
descExento   = imp_op_exentas    × pct
descTotal    = descGravado + descIva + descNoGravado + descExento
```

### 9.3. Recálculo de la retención

Con el neto ajustado:

```typescript
netoAjustado   = (gravado - descGravado) + (noGravado - descNoGravado) + (exento - descExento)
baseAjustada   = max(0, netoAjustado - minimoAplicado)
nuevaRetencion = baseAjustada × porcentaje_retencion
```

El desglose se guarda en `descuentoDesglose` (mostrado en el modal).

### 9.4. Limpiar descuento

`limpiarDescuentoSicore()` resetea el descuento y vuelve a llamar a `calcularRetencionSicore` para restaurar el cálculo original.

### 9.5. Campos guardados en BD al confirmar con descuento

```sql
UPDATE msa.comprobantes_arca SET
  monto_a_abonar    = imp_total - retencion - descuento,
  sicore            = '26-03 - 2da',
  monto_sicore      = 55742.85,
  tipo_sicore       = 'Servicios',
  descuento_aplicado = 50000.00  -- solo si > 0, sino NULL
WHERE id = '...'
```

---

## 10. Cancelación y Reversión

### 10.1. Cancelar (revertir estado anterior)

`cancelarGuardadoPendiente(false)` / `cancelarSicoreCF(false)`:

1. Restaura `estado` al valor previo en UI y BD.
2. Limpia toda la cola SICORE.
3. Cierra el modal.

### 10.2. Continuar sin retención

`cancelarGuardadoPendiente(true)` / `cancelarSicoreCF(true)`:

1. Mantiene el estado `'pagar'` en BD.
2. No aplica SICORE.
3. Si hay cola, avanza a la siguiente factura.

---

## 11. Corrección Técnica: Stale Closure (2026-03-18)

### Problema

React no actualiza el estado (variables `useState`) hasta el próximo render. Cuando `cambiarEstado` ejecuta esta secuencia:

```typescript
setGuardadoPendienteCF(pending)   // ← Encola actualización, NO actualiza ahora
await evaluarRetencionSicoreCF(fila)  // ← guardadoPendienteCF sigue siendo null
```

Dentro de `evaluarRetencionSicoreCF`, si la factura no califica y se llama `cancelarSicoreCF(true)`, la función leía `guardadoPendienteCF` (null) y **no guardaba el cambio de estado en BD**.

### Solución

Se agregaron parámetros opcionales `freshPending` y `freshCola` que se pasan explícitamente por toda la cadena de llamadas sincrónicas:

```typescript
type PendingSicore = { filaId: string, nuevoEstado: string, estadoAnterior: string }

const evaluarRetencionSicoreCF = async (
  fila: CashFlowRow,
  freshPending?: PendingSicore | null,
  freshCola?: CashFlowRow[]
) => { ... }

const cancelarSicoreCF = async (
  continuarSinSicore: boolean = false,
  freshPending?: PendingSicore | null,
  freshCola?: CashFlowRow[]
) => {
  // Usar datos frescos si se proporcionan; si no, leer del state (llamadas desde UI)
  const pending = freshPending !== undefined ? freshPending : guardadoPendienteCF
  const cola    = freshCola    !== undefined ? freshCola    : colaLoteSicore
  ...
}
```

**Commit que aplicó el fix**: `2ae5577`

**Regla**: Siempre que se llame a `evaluarRetencionSicoreCF` o `cancelarSicoreCF` **inmediatamente después de un `setState`**, se deben pasar los valores frescos como parámetros. Las llamadas desde la UI (botones del modal) usan el estado React directamente (sin parámetros), lo cual es correcto porque React ya re-renderizó.

---

## 12. SICORE para Anticipos de Proveedores

Los anticipos tienen su propio flujo SICORE dentro del Modal de Pagos (`vista-facturas-arca.tsx`).

### 12.1. Trigger

`cambiarEstadoAnticipoPago(anticipo, 'pagar')`:
- Si el anticipo **ya tiene** `sicore` + `monto_sicore` (fue procesado antes): aplica retención automáticamente, actualiza `monto_restante` y cierra.
- Si **no tiene** SICORE: abre el modal SICORE para anticipos (`mostrarModalSicoreAnt`).

### 12.2. Modal anticipos — diferencia con facturas

Los anticipos **no tienen** los campos de neto desglosado (gravado/noGravado/exento) cargados automáticamente. El operador los **ingresa manualmente** en el primer paso del modal:
- Neto gravado
- Neto no gravado
- Exento
- IVA

### 12.3. Vinculación a factura

Los anticipos SICORE deben vincularse a una factura antes del cierre de quincena. El campo `factura_id` en `anticipos_proveedores` establece el vínculo. Si hay anticipos sin vincular, el cierre de quincena **bloquea** con un mensaje de advertencia.

### 12.4. Verificación retención previa para anticipos

`verificarRetencionPreviaAnticipo(cuit, quincena)` consulta **ambas tablas**:
```typescript
// Busca en comprobantes_arca Y en anticipos_proveedores
const [{ data: d1 }, { data: d2 }] = await Promise.all([
  supabase.schema('msa').from('comprobantes_arca')
    .select('id').eq('cuit', cuit).eq('sicore', quincena).limit(1),
  supabase.from('anticipos_proveedores')
    .select('id').eq('cuit_proveedor', cuit).eq('sicore', quincena).limit(1)
])
return (d1?.length > 0) || (d2?.length > 0)
```

Esto garantiza que si ya retuvo en una factura, no aplica mínimo al anticipo del mismo proveedor en la misma quincena.

---

## 13. Ver Retenciones (cargarRetencionesVer)

La vista "Ver Retenciones" en el modal Pagos muestra todas las retenciones de una quincena seleccionada, combinando facturas y anticipos en una tabla unificada.

```typescript
// Query paralela a ambas tablas
const [{ data: facturas }, { data: anticipos }] = await Promise.all([
  supabase.schema('msa').from('comprobantes_arca')
    .select('id, denominacion_emisor, cuit, monto_sicore, imp_total, imp_neto_gravado, ...')
    .eq('sicore', quincena)
    .not('monto_sicore', 'is', null)
    .gt('monto_sicore', 0),
  supabase.from('anticipos_proveedores')
    .select('id, nombre_proveedor, cuit_proveedor, monto_sicore, ...')
    .eq('sicore', quincena)
    .not('monto_sicore', 'is', null)
    .gt('monto_sicore', 0)
])
```

Los resultados se ordenan por fecha y se muestran en una tabla con badge diferenciador (factura / anticipo).

**Selector de quincena**: muestra las últimas 12 quincenas. Al abrir el modal de Pagos, carga automáticamente la quincena actual.

---

## 14. Cierre de Quincena

### 14.1. Proceso (procesarCierreQuincena)

1. **Validación**: Verifica que no existan anticipos con SICORE sin vincular a factura. Si existen, muestra la lista y bloquea el cierre.

2. **Búsqueda**: `buscarRetencionesQuincena(quincena)` retorna todas las facturas con `sicore = quincena` y `monto_sicore > 0`, enriquecidas con datos del tipo (porcentaje, mínimo).

3. **Generación de reportes**: `generarReportesCierreQuincena()`:
   - Abre/reutiliza el directorio base (File System Access API).
   - Crea subcarpeta con el nombre de la quincena: `'26-02 - 1ra'`.
   - Genera Excel y PDF dentro de la subcarpeta.

4. **Resumen**: Muestra alert con cantidad de facturas y total de retenciones.

### 14.2. Generación Excel (generarExcelCierreQuincena)

Columnas del archivo Excel:

| # | Columna | Campo BD |
|---|---------|----------|
| 1 | Fecha Venc. | `fecha_vencimiento` |
| 2 | Fecha Emis. | `fecha_emision` |
| 3 | Proveedor | `denominacion_emisor` |
| 4 | CUIT | `cuit` |
| 5 | Tipo Comp. | `tipo_comprobante` |
| 6 | Nro. | `nro_comprobante` |
| 7 | Neto Grav. | `imp_neto_gravado` |
| 8 | Neto No Grav. | `imp_neto_no_gravado` |
| 9 | Op. Exentas | `imp_op_exentas` |
| 10 | IVA | `iva` |
| 11 | Imp. Total | `imp_total` |
| 12 | TC Pago | `tc_pago` |
| 13 | Tipo SICORE | `tipo_sicore` |
| 14 | % Retención | `_tipoConfig.porcentaje_retencion × 100` |
| 15 | Mínimo | `_tipoConfig.minimo_no_imponible` |
| 16 | Base Imponible | `imp_total × tc - mínimo` |
| 17 | Retención | `monto_sicore` |
| 18 | Descuento | `descuento_aplicado` |
| 19 | PAGO (saldo) | `imp_total × tc - monto_sicore - descuento` |

**Nombre archivo**: `SICORE_Cierre_YY-MM-Q_YYYY-MM-DD.xlsx`

### 14.3. Generación PDF (generarPDFCierreQuincena)

- **Orientación**: horizontal (landscape)
- **Librerías**: jsPDF + autoTable
- **Cabecera**: MARTINEZ SOBRADO AGRO SRL, CUIT 30-61778601-6, quincena, fecha generación
- **Tabla**: mismas 19 columnas que Excel
- **Fila de totales**: resaltada al final con totales de Neto Gravado, Retención y PAGO
- **Multipágina**: automático con autoTable
- **Nombre archivo**: `SICORE_Cierre_YY-MM-Q_YYYY-MM-DD.pdf`

---

## 15. Corrección de Quincena al Marcar como Pagado

Cuando se cambia el estado a `'pagado'` desde el Modal de Pagos y se especificó una `fechaPagoSeleccionada`, el sistema verifica si la quincena calculada con esa fecha difiere de la que tenía guardada:

```typescript
if (nuevoEstado === 'pagado') {
  for (const f of facturasACambiar) {
    if (!f.sicore) continue
    const fechaFinal    = fechaPagoSeleccionada || f.fecha_vencimiento
    const quincenahNueva = generarQuincenaSicore(fechaFinal)
    if (quincenahNueva !== f.sicore) {
      await supabase.schema('msa').from('comprobantes_arca')
        .update({ sicore: quincenahNueva })
        .eq('id', f.id)
    }
  }
}
```

Esto garantiza que el campo `sicore` siempre refleje la quincena **real del pago**, no la de la fecha de vencimiento original.

---

## 16. Flujo Completo — Diagrama Resumido

```
Usuario cambia estado → 'pagar'
        │
        ▼
¿Factura C (tipo 11)?
   SÍ → Guardar directamente
   NO ↓
        │
        ▼
¿Neto_pesos <= $67,170?
   SÍ → Guardar directamente (sin SICORE)
   NO ↓
        │
        ▼
¿Neto negativo?
   SÍ → ¿Retención previa en quincena?
          SÍ → Abrir modal (retención negativa)
          NO → Guardar directamente (sin SICORE)
   NO ↓
        │
        ▼
Abrir Modal SICORE — Paso 1: Seleccionar tipo
        │
        ▼
Paso 2: Ver cálculo
        │
   ┌────┴────────────────────────────┐
   │                                 │
   ▼                                 ▼
Confirmar                     Continuar sin retención
   │                                 │
   ▼                                 ▼
Actualizar BD:               Guardar estado 'pagar'
  estado = 'pagar'           sin SICORE
  sicore = 'YY-MM - Qda'
  monto_sicore = X
  tipo_sicore = 'Servicios'
  monto_a_abonar = total - X
        │
        ▼
¿Hay cola?
   SÍ → Procesar siguiente
   NO → Fin
```

---

## 17. Estados de una Factura con SICORE

| Campo | Valor inicial | Valor con SICORE |
|-------|--------------|------------------|
| `estado` | `'pendiente'` | `'pagar'` → `'pagado'` |
| `sicore` | `NULL` | `'26-03 - 2da'` |
| `monto_sicore` | `NULL` | `55742.85` |
| `tipo_sicore` | `NULL` | `'Servicios'` |
| `descuento_aplicado` | `NULL` | `50000` o `NULL` |
| `monto_a_abonar` | calculado original | `imp_total - retencion - descuento` |
| `tc_pago` | `NULL` | `1250.50` (solo USD) |

---

---

## 19. Tabla Paralela `msa.sicore_retenciones` (2026-03-19)

### 19.1. Objetivo

Registro paralelo y autocontenido de todas las retenciones aplicadas. **No reemplaza** los campos en `comprobantes_arca` o `anticipos_proveedores` — coexiste con ellos y provee una fuente de verdad propia para exportes de cierre.

**Invariante garantizada**: `retencion + pago = total_pagado` siempre.

### 19.2. Estructura

```sql
CREATE TABLE msa.sicore_retenciones (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quincena             VARCHAR(20)    NOT NULL,   -- '26-03 - 1ra'
  fecha_pago           DATE,
  origen               VARCHAR(20)    NOT NULL,   -- 'directo' | 'anticipo' | 'agrupacion'
  factura_id           UUID,
  anticipo_id          UUID,
  fecha_emision        DATE,
  tipo_comprobante     INTEGER,
  punto_venta          INTEGER,
  numero_desde         INTEGER,
  cuit_emisor          VARCHAR(20),
  denominacion_emisor  TEXT,
  tipo_sicore          VARCHAR(50),
  alicuota             DECIMAL(5,4),              -- 0.06, 0.02, 0.0025
  neto_gravado_pagado  DECIMAL(15,2),             -- imp_neto_gravado × (1 - descuento%)
  total_pagado         DECIMAL(15,2),             -- imp_total efectivamente abonado
  descuento_aplicado   DECIMAL(15,2),
  minimo_no_imponible  DECIMAL(15,2),
  base_imponible       DECIMAL(15,2),             -- monto_sicore / alicuota
  retencion            DECIMAL(15,2),             -- monto_sicore
  pago                 DECIMAL(15,2),             -- total_pagado - retencion
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- Permisos (aplicar siempre post-reconstrucción)
GRANT SELECT, INSERT, UPDATE ON msa.sicore_retenciones TO anon, authenticated;
```

**⚠️ Importante**: RLS está habilitado pero sin el GRANT el rol `anon` no puede leer. Ejecutar siempre el GRANT después de crear la tabla.

### 19.3. Campo `base_imponible`

Se deriva del resultado almacenado, **no** se recalcula desde campos crudos:

```typescript
base_imponible = monto_sicore / alicuota
```

Esto es correcto porque: en retenciones adicionales (mínimo = 0) y en casos con descuento, el base_imponible real difiere del que daría recalcular desde `neto_gravado`.

### 19.4. Campo `neto_gravado_pagado`

```typescript
neto_gravado_pagado = imp_neto_gravado × (1 - descuento_pct)
```

Donde `descuento_pct = descuento_aplicado / imp_total`.

### 19.5. Orígenes

| Origen | Fuente | Campos clave |
|--------|--------|--------------|
| `'directo'` | Factura ARCA — flujo individual | `factura_id` |
| `'anticipo'` | Anticipo de proveedor | `anticipo_id` |
| `'agrupacion'` | Factura ARCA — flujo en lote/cola | `factura_id` |

---

## 20. Helper `registrarEnSicoreRetenciones`

Función no bloqueante que se llama automáticamente al confirmar cualquier SICORE. Si falla, solo loguea el error sin interrumpir el flujo principal.

### 20.1. Puntos de inserción

| Función | Origen |
|---------|--------|
| `finalizarProcesoSicore()` | `'directo'` (individual) o `'agrupacion'` (cola) según `procesandoColaSicore` |
| `confirmarSicoreAnt()` | `'anticipo'` |

### 20.2. Lógica de `total_pagado` para anticipos

Para el flujo de anticipos, `total_pagado` = `monto_bruto_anticipo` (el importe total del pago al proveedor antes de retención). `pago` = `total_pagado - retencion` = lo efectivamente transferido.

### 20.3. Ejemplo de inserción

```typescript
const registrarEnSicoreRetenciones = async (datos: {
  quincena: string
  fecha_pago: string | null
  origen: 'directo' | 'anticipo' | 'agrupacion'
  factura_id?: string
  anticipo_id?: string
  // ... resto de campos
}) => {
  const { error } = await supabase.schema('msa')
    .from('sicore_retenciones')
    .insert(datos)
  if (error) console.error('Error registrando en sicore_retenciones:', error)
  // No throw — nunca interrumpe el flujo principal
}
```

---

## 21. Tab "Cierre v2"

### 21.1. Ubicación

Dentro del modal **SICORE — Retenciones Ganancias** → tab **🆕 Cierre v2**.

### 21.2. Comportamiento

- Al abrir el modal con este tab activo, **carga automáticamente** la quincena en curso.
- El selector de quincena tiene la quincena actual preseleccionada por defecto.
- Al cambiar la quincena, recarga los datos automáticamente.

### 21.3. Vista previa — tabla `TablaRegistrosV2`

Componente separado que muestra todos los registros de `msa.sicore_retenciones` para la quincena seleccionada:

| Columna | Campo |
|---------|-------|
| Origen | badge de color (azul=directo, violeta=anticipo, naranja=agrupacion) |
| Tipo | `tipo_sicore` |
| Fecha Pago | `fecha_pago` formateada DD/MM/AAAA |
| CUIT | `cuit_emisor` |
| Denominación | `denominacion_emisor` |
| Neto Grav. Pag. | `neto_gravado_pagado` |
| Total Pagado | `total_pagado` |
| Base Imp. | `base_imponible` |
| Alíc.% | `alicuota × 100` |
| Retención | `retencion` (rojo) |
| Pago | `pago` (verde) |

Fila de totales en footer con sumas de todas las columnas numéricas.

### 21.4. Generación Export v2

Botón **Generar Export v2** habilitado solo cuando hay registros cargados. Genera Excel y PDF leyendo exclusivamente de `msa.sicore_retenciones` — valores autocontenidos, sin recalcular desde `comprobantes_arca`.

### 21.5. Diferencia con "Cerrar Quincena" (tab anterior)

| Aspecto | Cerrar Quincena | Cierre v2 |
|---------|----------------|-----------|
| Fuente datos | `msa.comprobantes_arca` | `msa.sicore_retenciones` |
| Validación anticipos | Sí (bloquea si sin vincular) | No |
| Valores | Recalculados al momento del export | Autocontenidos (guardados al confirmar) |
| Ideal para | Control del proceso | Reporte final auditado |

---

## 22. Fix `confirmarVinculacion` (vista-principal.tsx)

Al vincular un anticipo SICORE a una factura desde la Vista Principal (panel Alertas de Pagos), la función ahora:

1. Copia `sicore`, `monto_sicore` **y `tipo_sicore`** del anticipo a la factura.
2. Calcula `monto_a_abonar = imp_total - monto_sicore` usando el `imp_total` real de la factura seleccionada.

**Antes**: `tipo_sicore` no se copiaba y `monto_a_abonar` podía quedar incorrecto.

---

## 23. Pendientes / TODO

- **Generación PDF comprobante retención individual** por proveedor (para envío).
- **Envío automático por email** del comprobante de retención al proveedor.
- **Llenado automático templates SICORE** (templates 60-61) al cerrar quincena.
- **Gestión masiva con SICORE en Cash Flow**: actualmente el botón PAGOS en CF procesa una por una; podría implementarse similar al Modal Pagos de Egresos.
- **Descuento adicional en Cash Flow**: la función existe en Egresos/Pagos pero no está implementada en CF.
- **Vista dedicada quincenas**: listar, ver estado (abierta/cerrada), historial.
- **SJC — fix BD manual pendiente**: `estado` ('pendiente' → 'pagado') y `monto_a_abonar` ($87,916.03 → $6,492,083.97). El `tipo_sicore` ya fue corregido manualmente.

---

*Archivo mantenido manualmente. Actualizar al implementar nuevas funcionalidades SICORE.*
