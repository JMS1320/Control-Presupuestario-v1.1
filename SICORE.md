# SICORE — Sistema de Retenciones de Ganancias AFIP

> Documentación técnica completa del módulo SICORE implementado en Control Presupuestario v1.1.
>
> **Última actualización**: 2026-04-15
> **Commits sesión**: `c6abd32`, `44c8d62`, `6fd54ad`, `1768f31`

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

### 21.4. Descarga de certificados individuales

`TablaRegistrosV2` acepta la prop `onCertificado?: (registro: any) => void`. Cuando se pasa, cada fila muestra un ícono `⬇` que llama a `generarCertificadoRetencion(registro)` para descargar el certificado de esa retención específica.

En el tab Cierre v2, se pasa: `<TablaRegistrosV2 registros={registrosV2} onCertificado={generarCertificadoRetencion} />`.

### 21.5. Descarga masiva de certificados (Certificados de Retención)

Botón **"Certificados de Retención (N)"** — donde N = cantidad de registros cargados.

**Flujo:**
1. Llama a `descargarTodosLosCertificados()`.
2. Abre selector de carpeta con `window.showDirectoryPicker({ mode: 'readwrite' })`.
3. Itera cada registro de `registrosV2`, llama a `generarCertificadoRetencion(registro, true)` que retorna un `ArrayBuffer` en lugar de disparar descarga directa.
4. Crea cada archivo en la carpeta elegida con `dirHandle.getFileHandle(nombre, { create: true })`.
5. Al finalizar, muestra alert con cantidad de certificados guardados.

**Nombre por archivo:** `CertRet_[CUIT]_[Proveedor]_[Fecha].pdf`

**Manejo de cancelación:** Si el usuario cierra el selector de carpeta, `err.name === 'AbortError'` → no muestra error.

### 21.6. Generación Export v2

Botón **Generar Export v2** habilitado solo cuando hay registros cargados. Genera Excel y PDF leyendo exclusivamente de `msa.sicore_retenciones` — valores autocontenidos, sin recalcular desde `comprobantes_arca`.

### 21.5. Diferencia con "Cerrar Quincena" (tab anterior)

| Aspecto | Cerrar Quincena | Cierre v2 |
|---------|----------------|-----------|
| Fuente datos | `msa.comprobantes_arca` | `msa.sicore_retenciones` |
| Validación anticipos | Sí (bloquea si sin vincular) | No |
| Valores | Recalculados al momento del export | Autocontenidos (guardados al confirmar) |
| Ideal para | Control del proceso | Reporte final auditado |

---

## 22. Wizard de Vinculación Anticipo → Factura (vista-principal.tsx)

### 22.1. Contexto

Desde el panel de Alertas de Pagos en Vista Principal, los anticipos SICORE que ya tienen `monto_sicore > 0` pueden vincularse a una factura del proveedor. La vinculación aplica la retención sobre la factura y cancela (parcial o totalmente) el importe.

### 22.2. Casos de vinculación

**Caso A — La factura queda totalmente cancelada:**
```
anticipo.monto >= factura.imp_total
→ estado = 'pagado'
→ fecha_vencimiento = anticipo.fecha_pago
→ fecha_estimada   = anticipo.fecha_pago
→ monto_a_abonar   = neto_pagado  (anticipo.monto - monto_sicore - descuento)
```

**Caso B — La factura queda parcialmente cubierta:**
```
anticipo.monto < factura.imp_total
→ estado = 'pendiente'  (sigue en flujo)
→ monto_a_abonar = factura.imp_total - anticipo.monto  (saldo restante)
```

En ambos casos se copian a `comprobantes_arca`:
```sql
sicore            = anticipo.sicore
monto_sicore      = anticipo.monto_sicore
tipo_sicore       = anticipo.tipo_sicore
factura_id        -- en anticipos_proveedores
```

### 22.3. Wizard 2 pasos (UI)

**Paso 1 — Selección de factura:**
- Lista de facturas del proveedor con `estado = 'pendiente'`.
- Al seleccionar una, se calcula y muestra un card inline:
  - Caso A/B, saldo, neto pagado.
  - Badges con `anticipo.monto`, `monto_sicore`, `descuento_aplicado`.

**Paso 2 — Confirmación:**
- Lista "Lo que va a pasar":
  - Factura X queda `pagada` / queda con saldo $Y.
  - SICORE aplicado: $Z.
  - Transferencia neta: $W.
- Botón Confirmar ejecuta `confirmarVinculacion()`.

### 22.4. `neto_pagado`

```typescript
neto_pagado = anticipo.monto - (anticipo.monto_sicore || 0) - (anticipo.descuento_aplicado || 0)
```

Es el importe real que salió de la cuenta bancaria hacia el proveedor.

### 22.5. Interface `CalcVinculacion`

```typescript
interface CalcVinculacion {
  caso: 'A' | 'B'
  saldo: number        // Caso A: 0 (o monto - imp_total). Caso B: imp_total - anticipo.monto
  neto_pagado: number  // monto - sicore - descuento
  descuento: number
  sicore: number
}
```

---

## 23. Llenado automático de cuota al cerrar quincena (2026-04-15)

Al finalizar `procesarCierreV2` (después de generar Excel + PDF + TXT), el sistema propone automáticamente actualizar la cuota del template SICORE correspondiente.

### Lógica

- Quincena `YY-MM - 1ra` → template **"SICORE 1er Quincena"** (ID `19b879c7-d8c1-4633-8910-55e567e7394d`)
  - `fecha_estimada` = día **20** del mismo mes → ej: `26-04 - 1ra` → `2026-04-20`
- Quincena `YY-MM - 2da` → template **"SICORE 2da Quincena"** (ID `2f0f8552-74ef-496a-9dbf-92ff97f6aca1`)
  - `fecha_estimada` = día **9** del mes siguiente → ej: `26-04 - 2da` → `2026-05-09`

El sistema busca la cuota existente por `egreso_id + fecha_estimada` y hace un **UPDATE del monto** (las cuotas ya están pre-creadas con `monto = 0`).

### Flujo UX

1. Se genera cierre normalmente (Excel + PDF + TXT)
2. Alert resumen con totales
3. `window.confirm()`: *"¿Actualizar cuota en template 'SICORE 1er/2da Quincena'? Monto: $X.XXX,XX Fecha estimada: YYYY-MM-DD"*
4. Si confirma → UPDATE → alert de confirmación

### Funciones involucradas

- `parsearCuotaSicore(quincena)` — determina templateId + fechaEstimada + nombre desde el string de quincena
- `llenarCuotaSicore(quincena, totalRet)` — busca cuota y hace UPDATE
- `procesarCierreV2` — llama a ambas al final del flujo

---

## 24. Pendientes / TODO

- **Envío automático por email** del certificado de retención al proveedor.
- **Gestión masiva con SICORE en Cash Flow**: actualmente el botón PAGOS en CF procesa una por una; podría implementarse similar al Modal Pagos de Egresos.
- **Descuento adicional en Cash Flow**: la función existe en Egresos/Pagos pero no está implementada en CF.
- **Vista dedicada quincenas**: listar, ver estado (abierta/cerrada), historial.

---

## 24. Comprobante de Pago PDF (`generarPDFDetallePago`)

### 24.1. Cambios respecto a versión anterior

El documento se renombró de "Detalle de Pago" a **"COMPROBANTE DE PAGO"**. Se eliminó toda referencia a términos internos ("anticipo", "SICORE") y se reformuló con terminología contable formal.

### 24.2. Estructura del documento

```
COMPROBANTE DE PAGO
MARTINEZ SOBRADO AGRO SRL — CUIT 30-61778601-6
Fecha de Pago: DD/MM/AAAA

Beneficiario: [proveedor]
CUIT: [cuit]

[Tabla]
```

**Columnas de la tabla:**

| Columna | Descripción |
|---------|-------------|
| Comprobante | Número/tipo de la factura |
| Fecha | Fecha de emisión |
| Total Factura | `imp_total` |
| Retención Ganancias | `monto_sicore` (solo si > 0) |
| Descuento | `descuento_aplicado` (solo si > 0) |
| Monto Transferido | Lo que efectivamente salió de la cuenta |
| Total Cancelado | Monto Transferido + Retención Ganancias |

**Fila de totales**: fondo gris, negrita.

### 24.3. Fecha de Pago

- Si el pago fue mediante anticipo: `anticipo.fecha_pago` formateada DD/MM/AAAA.
- Si fue pago directo: fecha del día de generación del documento.

### 24.4. Caso anticipo

Cuando se pasa el parámetro `anticipo`, los valores de retención y descuento vienen del anticipo (no de los items). La fórmula:

```
Monto Transferido = anticipo.monto - anticipo.monto_sicore - anticipo.descuento_aplicado
Total Cancelado   = Monto Transferido + anticipo.monto_sicore
```

### 24.5. Nombre del archivo generado

```
ComprobantePago_[Proveedor]_[Fecha].pdf
```

---

## 25. Certificado de Retención Ganancias PDF (`generarCertificadoRetencion`)

### 25.1. Descripción

Documento formal para entregar al proveedor, replicando el formato del sistema anterior (SAN MANUEL SRL). Se genera desde el tab **Cierre v2** del modal SICORE.

### 25.2. Estructura del documento

```
┌─────────────────────────────────────────────────────────┐
│         CERTIFICADO DE RETENCIÓN Ganancias              │
├──────────────────────────────────────────────────────────┤
│ Comprobante N°  2026-XXXXXXXX        Fecha: DD/MM/AAAA  │
├──────────────────────────────────────────────────────────┤
│ Agente de Retención                                      │
│   MARTINEZ SOBRADO AGRO SRL                              │
│   Domicilio Fiscal: LIBERTAD 1366 - 9 PISO              │
│   Localidad: Capital Federal                             │
│   Provincia: Capital Federal                             │
│   C.U.I.T. Nro: 30-61778601-6                           │
│   Ingresos Brutos: 30617786016                           │
├──────────────────────────────────────────────────────────┤
│ Sujeto Pasible de Retención                              │
│   Apellido y Nombre o Razón Social: [proveedor]         │
│   C.U.I.T. Nro: XX-XXXXXXXX-X                           │
├──────────────────────────────────────────────────────────┤
│ Datos de la Retención                                    │
│ ┌──────────────────┬──────────┬──────────┬───────────┐  │
│ │Comprob. origen   │Monto comp│Ret. Prac.│Régimen    │  │
│ │Factura A 0010-.. │$X.XXX    │$X.XXX    │SERVICIOS  │  │
│ └──────────────────┴──────────┴──────────┴───────────┘  │
│                   Total de la Retención en $  $X.XXX    │
├──────────────────────────────────────────────────────────┤
│ Firma Autorizada Gcia.    [Recibí el original...]       │
│ ________________   ________                              │
│ Firma y Aclaración   Fecha                               │
│ [Disclaimer legal]                                       │
└─────────────────────────────────────────────────────────┘
```

### 25.3. Comprobante N°

Generado como: `AAAA-XXXXXXXX` donde `XXXXXXXX` son los primeros 8 caracteres del UUID del registro en `msa.sicore_retenciones` (sin guiones, en mayúsculas).

Ejemplo: `2026-E8ECABCD` para el registro `e8ecabcd-6fdd-...`.

> No existe un contador secuencial. El UUID garantiza unicidad del certificado. Si se requiere numeración correlativa en el futuro, agregar campo `numero_certificado SERIAL` a `sicore_retenciones`.

### 25.4. Comprob. que origina la retención

Se construye desde los campos de `sicore_retenciones`:

```typescript
const letraComprobante = (tipo: number) => ({
  1:'A', 2:'A', 3:'A',
  6:'B', 7:'B', 8:'B',
  11:'C', 12:'C', 13:'C',
  51:'M', 52:'M', 53:'M',
  201:'A', 206:'B', 211:'C', ...
}[tipo] || String(tipo))

const texto = `Factura ${letra}  ${pv.padStart(4,'0')}-${nro.padStart(8,'0')}   (${fechaEmision})`
// Ej: "Factura A  0010-00005926   (20/02/2026)"
```

### 25.5. Régimen (mapeo desde tipo_sicore)

| tipo_sicore contiene | Régimen en certificado |
|----------------------|------------------------|
| `arrendamiento` | ARRENDAMIENTO |
| `bien` | COMPRA DE BS. DE CAMBIO |
| `servicio` | LOCACIÓN DE SERVICIOS |
| `transporte` | TRANSPORTE |

### 25.6. Modos de generación

La función acepta un segundo parámetro `returnBytes: boolean`:

```typescript
// Descarga directa (desde botón por fila)
await generarCertificadoRetencion(registro)           // → doc.save()

// Retorna bytes (para descarga masiva)
const bytes = await generarCertificadoRetencion(registro, true)  // → ArrayBuffer
```

### 25.7. Nombre del archivo

```
CertRet_[CUIT_sin_guiones]_[Proveedor_20chars]_[DD-MM-AAAA].pdf
// Ej: CertRet_20103619115_ALCORTA_EDMUNDO_ERNESTO_05-03-2026.pdf
```

---

## 26. Fix SJC — Aplicación Manual BD (2026-03-19)

### 26.1. Situación

La factura de SJC fue pagada mediante anticipo (Caso A: `anticipo.monto = $6,580,000 = factura.imp_total`). La retención de `$87,916.03` estaba correctamente registrada en `msa.sicore_retenciones` con `origen='anticipo'`. Sin embargo, la factura tenía:

| Campo | Valor incorrecto | Valor correcto |
|-------|-----------------|----------------|
| `estado` | `'pendiente'` | `'pagado'` |
| `monto_a_abonar` | `$87,916.03` | `$6,492,083.97` |
| `fecha_vencimiento` | `2026-03-20` | `2026-03-05` |

### 26.2. SQL aplicado

```sql
UPDATE msa.comprobantes_arca SET
  estado           = 'pagado',
  monto_a_abonar   = 6492083.97,
  fecha_vencimiento = '2026-03-05',
  fecha_estimada   = '2026-03-05'
WHERE id = '229d7c3e-50c3-485a-ae5a-9c8268c7a838';
-- Resultado: 1 fila actualizada ✅
```

### 26.3. Cálculo `monto_a_abonar`

```
neto_pagado = anticipo.monto - monto_sicore - descuento_aplicado
            = 6,580,000 - 87,916.03 - 0
            = 6,492,083.97
```

### 26.4. Estado post-fix

- ✅ Retención registrada en `sicore_retenciones` con `origen='anticipo'`
- ✅ Factura en estado `'pagado'`
- ✅ Botón "Detalle de pago" disponible → detecta el anticipo por `factura_id` → genera PDF con formato anticipo

---

---

## 27. Sección 18 — No Documentada (reservada)

*El número 18 quedó sin uso al reorganizar secciones. No hay funcionalidad correspondiente.*

---

## 28. Integración SICORE + ECHEQ (2026-03-20)

Cuando el pago se realiza con un cheque electrónico, el flujo SICORE se combina con el flujo ECHEQ. Ver documentación completa en **ECHEQ.md**. Puntos clave:

### 28.1. La quincena se calcula por `fecha_emision` del ECHEQ

Para los anticipos:
```typescript
const fechaParaQuincena = echeqPendienteRef.current?.fechaEmision || anticipo.fecha_vencimiento
const quincena = generarQuincenaSicore(fechaParaQuincena)
```

La `fecha_emision` del ECHEQ es la fecha en que se emite el cheque, que es la fecha real del pago. Esto es correcto porque la obligación tributaria nace cuando se realiza el pago.

### 28.2. Estado final es 'echeq' en lugar de 'pagar'

Cuando `echeqPendienteRef.current` está cargado al momento de confirmar SICORE:

```typescript
// En finalizarProcesoSicore (facturas):
const esEcheqFactura = !!echeqPendienteRef.current
if (esEcheqFactura) {
  updateFactura.estado         = 'echeq'
  updateFactura.metodo_pago    = 'echeq'
  updateFactura.fecha_cobro_echeq = echeqPendienteRef.current!.fechaCobro
}

// En confirmarSicoreAnt (anticipos):
if (esEcheq) {
  updateData.estado_pago       = 'echeq'
  updateData.fecha_pago        = echeqPendienteRef.current!.fechaEmision
  updateData.fecha_cobro_echeq = echeqPendienteRef.current!.fechaCobro
}
```

### 28.3. El cheque se registra en msa.cheques con el SICORE

```typescript
await guardarCheques(
  [facturaEnProceso],
  echeqPendienteRef.current,
  { monto: montoRetencion, tipo: tipoSeleccionado.tipo, quincena }
)
// → msa.cheques.sicore, msa.cheques.monto_sicore, msa.cheques.tipo_sicore
```

El monto guardado en el cheque es `imp_total - monto_sicore` (lo que realmente se paga al proveedor).

### 28.4. Tabla de estados con SICORE + ECHEQ

| Campo | Sin ECHEQ | Con ECHEQ |
|-------|-----------|-----------|
| `estado` | `'pagar'` | `'echeq'` |
| `sicore` | `'26-03 - 2da'` | `'26-03 - 2da'` |
| `monto_sicore` | `55742.85` | `55742.85` |
| `metodo_pago` | `NULL` | `'echeq'` |
| `fecha_cobro_echeq` | `NULL` | `'2026-04-15'` |
| Registro en `msa.cheques` | No | Sí |

---

## 29. Fixes SICORE — Sesión 2026-03-26

### 29.1. SICORE USD — Aplicar TC en evaluación, cálculo y modal (`278aac6`)

**Problema**: Las facturas en USD no convertían correctamente el neto a pesos antes de comparar con los mínimos SICORE ni al calcular la base imponible.

**Fixes aplicados en `vista-facturas-arca.tsx`**:

- `evaluarRetencionSicore`: `netoFactura` se multiplica por `tc_pago` antes de comparar contra los mínimos.
- `calcularRetencionSicore`: la base imponible se calcula en ARS (`neto × tc_pago`), produciendo la retención correcta.
- `finalizarProcesoSicore`: retención y descuento se dividen por `tc_pago` al guardar en BD (se almacenan en moneda original).
- Modal paso 2: `impTotal`, `impGravado` e `iva` se muestran multiplicados por `tc_pago` → siempre en ARS.

**Flujo solo-descuento para USD bajo mínimo**: cuando la factura en USD no supera el mínimo del tipo, se ofrece descuento pronto pago mediante `confirm dialog`. Guard en `finalizarProcesoSicore` permite continuar sin `tipoSeleccionado`.

---

### 29.2. Modal descuento-solo + display ARS exacto sin redondeo doble (`e660166`)

**Problema 1**: El modal paso 2 no renderizaba cuando `tipoSeleccionado = null` (flujo solo-descuento para facturas bajo el mínimo).
**Fix**: Condicional ampliado para renderizar el paso 2 también cuando no hay tipo seleccionado.

**Problema 2**: Los montos en ARS mostraban artefactos de redondeo por doble conversión USD→ARS.
**Fix**: `montoEnPesos`, `montoPesos`, totales de grupo, ECHEQ y PDF usan directamente `imp_total × tc - sicore - descuento` cuando hay retención o descuento, eliminando la doble conversión.

**Fix adicional**: El alert final de `finalizarProcesoSicore` muestra el saldo en ARS correcto (no en USD).

---

### 29.3. Descuento disponible cuando el tipo no supera su mínimo (`8404a25`)

**Problema**: Al seleccionar un tipo SICORE (ej: Bienes) y el neto estar por debajo del mínimo de ese tipo, el modal cerraba sin ofrecer alternativa.

**Fix**: En lugar de cerrar, el modal avanza al paso 2 con `montoRetencion = 0`, permitiendo aplicar descuento pronto pago. También se removió el guard `!tipoSeleccionado` en `aplicarDescuentoSicore`.

**Resultado**: El usuario puede aplicar descuento incluso cuando no corresponde retención por el tipo seleccionado.

---

### 29.4. Botones paso 2 — "Sin descuento" vs "Abortar" (`d830557`)

**Problema**: El botón ❌ en el paso 2 era ambiguo: no quedaba claro si cancelaba solo el descuento o abortaba todo el proceso.

**Fix**: Reemplazado por dos botones con semánticas claras:

| Botón | Acción |
|-------|--------|
| **Sin descuento** | Confirma el pago sin retención ni descuento — ejecuta `ejecutarGuardadoPendiente()` |
| **🚫 Abortar** | Revierte el cambio de estado — ejecuta `cancelarGuardadoPendiente()` |

---

### 29.5. Flag `sinRetencion` en `aplicarDescuentoSicore` (`e6fda05`)

**Problema**: Al aplicar descuento en modo "sin retención" (neto < mínimo del tipo), `aplicarDescuentoSicore` recalculaba `montoRetencion` al 2% en lugar de mantenerlo en 0.

**Fix**: Campo `sinRetencion: boolean` agregado a `datosSicoreCalculo`. Cuando `sinRetencion = true`, `aplicarDescuentoSicore` y `limpiarDescuentoSicore` preservan `montoRetencion = 0` sin recalcular.

---

---

## 30. Pendiente — Deprecar SICORE v1

### 30.1. Arquitectura actual (dos capas paralelas)

| | V1 | V2 |
|---|---|---|
| **Dónde** | Campos inline en `msa.comprobantes_arca` | Tabla separada `msa.sicore_retenciones` |
| **Campos** | `sicore`, `monto_sicore`, `tipo_sicore` | Una fila por evento con detalle completo |
| **Query** | `WHERE sicore = quincena AND monto_sicore > 0` | `WHERE quincena = quincena` |
| **Granularidad** | Por factura | Por evento (permite múltiples por factura) |
| **Estado** | Activo (legacy) | Activo (nuevo) |

### 30.2. Plan de deprecación

1. **Verificar cobertura**: confirmar que v2 cubre todos los casos (ARS, USD, anticipos, agrupaciones)
2. **Migrar huérfanos**: facturas con v1 data sin par en v2 → `INSERT INTO sicore_retenciones` desde `comprobantes_arca`
3. **Unificar queries**: `buscarRetencionesQuincena` (v1) y `buscarRetencionesV2` → una sola función leyendo v2
4. **Unificar UI**: panel SICORE "Ver Retenciones" y "Cierre Quincena" → solo v2
5. **Evaluar columnas**: decidir si eliminar físicamente `sicore/monto_sicore/tipo_sicore` de `comprobantes_arca` o conservarlas como audit trail

### 30.3. Botón "Resetear a estado importado" (2026-04-08)

Disponible en el dropdown (⋯) de cada factura en la vista ARCA. Visible solo cuando la factura tiene `sicore`, `tc_pago` o `descuento_aplicado`.

**Qué hace:**
- Borra fila de `sicore_retenciones` (v2) — requiere GRANT DELETE al rol `anon` (ver guía reconstrucción)
- Limpia campos v1: `sicore=null`, `monto_sicore=null`, `tipo_sicore=null`, `descuento_aplicado=null`, `tc_pago=null`
- Restaura `monto_a_abonar = imp_total` en moneda original (USD o ARS)
- Vuelve `estado = 'pendiente'`

Permite reprocessar una factura desde cero si SICORE se procesó incorrectamente.

---

## 31. Facturas en moneda extranjera (USD) — convenciones (2026-04-08)

### 31.1. Almacenamiento

| Campo | Moneda | Notas |
|-------|--------|-------|
| `imp_total` | Moneda original (USD) | Valor AFIP |
| `tipo_cambio` | — | TC del día AFIP al importar |
| `tc_pago` | — | TC al momento del pago (ingresado por el usuario) |
| `monto_a_abonar` | Moneda original (USD) | `imp_total - retención/TC - descuento/TC` |
| `monto_sicore` | ARS | Siempre en pesos, independiente de la moneda |
| `descuento_aplicado` | ARS | Siempre en pesos |

### 31.2. Tabla `sicore_retenciones` — todos los campos en ARS

Para facturas USD, los campos de detalle se calculan multiplicando por `tc_pago`:

```
neto_gravado_pagado = imp_neto_gravado × tc_pago
total_pagado        = imp_total × tc_pago
base_imponible      = max(0, neto_gravado_pagado − minimo_no_imponible)
retencion           = base_imponible × alicuota   (en ARS)
pago                = total_pagado − retencion    (en ARS)
```

Se usan los valores de `datosSicoreCalculo` (calculados por el modal, con tc ya aplicado) para evitar recálculos.

### 31.3. Cash Flow — cálculo de débitos para USD

El hook `useMultiCashFlowData.ts` usa la fórmula directa en ARS para evitar error de redondeo al reconvertir `monto_a_abonar` (USD redondeado) × TC:

```typescript
// Para moneda extranjera:
debitos = imp_total × tc - monto_sicore - descuento_aplicado

// Para ARS (sin cambio):
debitos = monto_a_abonar × tc
```

### 31.4. Permisos BD requeridos

```sql
-- Necesario para que el botón Reset funcione desde el navegador (rol anon)
GRANT DELETE ON msa.sicore_retenciones TO anon;
```

Este GRANT no está en el backup original — ver sección en `GUIA_RAPIDA_RECONSTRUCCION.md`.

*Archivo mantenido manualmente. Actualizar al implementar nuevas funcionalidades SICORE.*
