# ECHEQ — Cheques Electrónicos (e-Cheq)

> Documentación técnica del módulo ECHEQ implementado en Control Presupuestario v1.1.
>
> **Última actualización**: 2026-03-20
> **Commits sesión**: `5a021c7`, `25b9ae1`

---

## 1. Introducción

Un ECHEQ (e-Cheq) es un cheque electrónico emitido desde el homebanking del banco. En el sistema se registra cuando se paga una **factura ARCA** o un **anticipo de proveedor** usando este método.

Diferencia clave con una transferencia:
- La transferencia impacta en la cuenta bancaria en la fecha del pago.
- El ECHEQ impacta en la cuenta bancaria en la **fecha de cobro** (cuando el proveedor lo deposita), que puede ser semanas o meses después.

Por eso en el Cash Flow, los ítems pagados por ECHEQ se muestran en la **`fecha_cobro_echeq`**, no en la fecha de emisión.

---

## 2. Datos del ECHEQ

Cuando se emite un ECHEQ, se capturan:

| Campo | Descripción | Obligatorio |
|-------|-------------|-------------|
| `banco` | Banco emisor (ej: "Galicia", "Santander") | ✅ |
| `numero` | Número del cheque | ❌ (se puede completar después) |
| `fechaEmision` | Fecha en que se emite el cheque | ✅ |
| `fechaCobro` | Fecha en que lo cobra el proveedor | ✅ |

---

## 3. Estructura de Base de Datos

### 3.1. Tabla `msa.cheques`

```sql
CREATE TABLE msa.cheques (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero           VARCHAR(50),           -- Número del cheque (puede ser NULL inicialmente)
  banco            VARCHAR(100) NOT NULL,
  monto            DECIMAL(15,2) NOT NULL,
  moneda           VARCHAR(3) DEFAULT 'ARS',
  fecha_emision    DATE NOT NULL,
  fecha_cobro      DATE NOT NULL,         -- Determina la posición en Cash Flow
  beneficiario_nombre VARCHAR(200),
  beneficiario_cuit   VARCHAR(20),
  factura_id       UUID REFERENCES msa.comprobantes_arca(id),  -- NULL si es anticipo
  anticipo_id      UUID REFERENCES public.anticipos_proveedores(id),  -- NULL si es factura
  sicore           VARCHAR(20),           -- Quincena SICORE si aplica
  monto_sicore     DECIMAL(15,2),
  tipo_sicore      VARCHAR(50),
  concepto         TEXT,
  estado           VARCHAR(20) DEFAULT 'vigente',  -- vigente | depositado | cobrado | rechazado
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### 3.2. Columnas ECHEQ en `msa.comprobantes_arca`

```sql
ALTER TABLE msa.comprobantes_arca
  ADD COLUMN metodo_pago       VARCHAR(20),   -- 'echeq' cuando se paga con ECHEQ
  ADD COLUMN fecha_cobro_echeq DATE;          -- Fecha de cobro (para posición en Cash Flow)
```

### 3.3. Columnas ECHEQ en `anticipos_proveedores`

```sql
-- Los mismos campos en anticipos:
metodo_pago       VARCHAR(20)  -- 'echeq'
fecha_cobro_echeq DATE
fecha_pago        DATE         -- Fecha de emisión del ECHEQ
```

### 3.4. Estado 'echeq' en constraints

Ambas tablas tienen CHECK constraints que incluyen `'echeq'` como estado válido:

```sql
-- comprobantes_arca
-- estado CHECK: 'pendiente' | 'pagar' | 'preparado' | 'programado' | 'pagado' | 'echeq' | 'historico'

-- anticipos_proveedores
-- estado_pago CHECK: 'pendiente' | 'pagar' | 'preparado' | 'programado' | 'pagado' | 'conciliado' | 'echeq'
```

**Nota**: si la BD se reconstruye desde backup, verificar que estos constraints incluyen `'echeq'`. Si no, ejecutar:

```sql
-- Para comprobantes_arca
ALTER TABLE msa.comprobantes_arca DROP CONSTRAINT IF EXISTS comprobantes_arca_estado_check;
ALTER TABLE msa.comprobantes_arca ADD CONSTRAINT comprobantes_arca_estado_check
  CHECK (estado IN ('pendiente','pagar','preparado','programado','pagado','echeq','historico'));

-- Para anticipos_proveedores
ALTER TABLE public.anticipos_proveedores DROP CONSTRAINT IF EXISTS anticipos_proveedores_estado_pago_check;
ALTER TABLE public.anticipos_proveedores ADD CONSTRAINT anticipos_proveedores_estado_pago_check
  CHECK (estado_pago IN ('pendiente','pagar','preparado','programado','pagado','conciliado','echeq'));
```

---

## 4. Estado 'echeq' en el flujo de pagos

El estado `'echeq'` es un estado **final de pago alternativo** a `'pagar'`. Un ítem con estado `'echeq'` significa:

> "Se emitió un ECHEQ para pagar este ítem. El dinero aún no salió de la cuenta; saldrá cuando el proveedor deposite el cheque en la fecha de cobro."

**Flujo normal (transferencia):**
```
pendiente → pagar → preparado → programado → pagado
```

**Flujo con ECHEQ:**
```
pendiente → echeq
```
(el ítem ya está "pagado" desde el punto de vista del compromiso, pero el débito bancario ocurrirá en `fecha_cobro_echeq`)

---

## 5. Flujo en la Vista de Pagos (Modal Pagos)

### 5.1. Botón ECHEQ

Aparece junto al botón de acción principal en cada bloque de facturas o anticipos. **No aparece en el bloque "Pagados"** (`accionBoton.estado !== 'pagado'`).

Al hacer clic:
```typescript
setEcheqForm({ banco: '', numero: '', fechaEmision: hoy, fechaCobro: '' })
setEcheqEstadoDestino('pagar')  // Siempre 'pagar' — para ir por el flujo SICORE
setEcheqOrigen('facturas' | 'anticipos')
setMostrarModalEcheq(true)
```

### 5.2. Modal ECHEQ

Formulario con los 4 campos. Al confirmar:

```typescript
echeqPendienteRef.current = { banco, numero, fechaEmision, fechaCobro }
setEcheqPendiente(datos)
setMostrarModalEcheq(false)

// Llamar al handler correspondiente con 'pagar' y fechaEmision como fecha efectiva
if (echeqOrigen === 'anticipos') {
  cambiarEstadoAnticiposRef.current?.('pagar', datos.fechaEmision)
} else {
  cambiarEstadoSeleccionadasRef.current?.('pagar', datos.fechaEmision)
}
```

**¿Por qué `echeqPendienteRef` y no `useState`?**

Las funciones `cambiarEstadoAnticipoPago` y `cambiarEstadoSeleccionadas` son funciones async que se ejecutan sincrónicamente con el flujo. `useState` no actualiza hasta el próximo render, por lo que usaría un valor `null` stale. `useRef` es sincrónico: `.current` siempre refleja el valor más reciente.

### 5.3. Flujo SICORE + ECHEQ (facturas desde 'pendiente')

Cuando las facturas seleccionadas son de estado `'pendiente'` y su neto supera el umbral SICORE:

1. `cambiarEstadoSeleccionadas('pagar', fechaEmisionEcheq)` detecta SICORE.
2. Abre el modal SICORE. El campo `echeqPendienteRef.current` sigue cargado.
3. Al confirmar SICORE (`finalizarProcesoSicore`):
   ```typescript
   const esEcheqFactura = !!echeqPendienteRef.current
   if (esEcheqFactura) {
     updateFactura.estado = 'echeq'
     updateFactura.metodo_pago = 'echeq'
     updateFactura.fecha_cobro_echeq = echeqPendienteRef.current.fechaCobro
   }
   // Luego guardarCheques(...)
   echeqPendienteRef.current = null
   ```
4. La factura queda con `estado = 'echeq'` y el cheque en `msa.cheques`.

### 5.4. Flujo sin SICORE (facturas en 'pagar', 'preparado', etc. o bajo umbral)

Para facturas que no requieren SICORE (ya están en 'pagar'/'preparado', o son Factura C, o bajo el mínimo), el estado final se determina en `cambiarEstadoSeleccionadas`:

```typescript
const estadoEfectivo = (echeqFecha || echeqPendienteRef.current) && nuevoEstado === 'pagar'
  ? 'echeq'
  : nuevoEstado

const datosUpdate: any = { estado: estadoEfectivo }
if (echeqPendienteRef.current && estadoEfectivo === 'echeq') {
  datosUpdate.metodo_pago = 'echeq'
  datosUpdate.fecha_cobro_echeq = echeqPendienteRef.current.fechaCobro
}
```

Después del update en BD:
```typescript
if (echeqPendienteRef.current && nuevoEstado === 'pagar') {
  await guardarCheques(facturasACambiar, echeqPendienteRef.current, null)
  echeqPendienteRef.current = null
  setEcheqPendiente(null)
}
```

### 5.5. Flujo SICORE + ECHEQ para anticipos

En `cambiarEstadoAnticipoPago(anticipo, 'pagar')`:

```typescript
const esEcheq = !!echeqPendienteRef.current

// Si el anticipo ya tiene SICORE calculado (ya se procesó antes):
const updateData: any = {
  estado_pago: esEcheq ? 'echeq' : 'pagar',
  monto_restante: saldo
}
if (esEcheq) {
  updateData.metodo_pago = 'echeq'
  updateData.fecha_cobro_echeq = echeqPendienteRef.current!.fechaCobro
  updateData.fecha_pago = echeqPendienteRef.current!.fechaEmision
  await guardarCheques([], echeqPendienteRef.current!, null, anticipo.id, anticipo)
  echeqPendienteRef.current = null
}
```

Si el anticipo **no tiene** SICORE y corresponde retener, se abre el modal SICORE de anticipos. Al confirmar (`confirmarSicoreAnt`):
```typescript
// Usa fechaEmision del ECHEQ para calcular la quincena
const fechaParaQuincena = echeqPendienteRef.current?.fechaEmision || anticipo.fecha_vencimiento
const quincena = generarQuincenaSicore(fechaParaQuincena)

// Al finalizar:
if (esEcheq) {
  updateData.estado_pago = 'echeq'
  updateData.fecha_pago  = echeqPendienteRef.current.fechaEmision
  updateData.fecha_cobro_echeq = echeqPendienteRef.current.fechaCobro
  await guardarCheques([], echeqPendienteRef.current, sicore, anticipo.id, anticipo)
  echeqPendienteRef.current = null
}
```

---

## 6. Protección contra duplicados en `guardarCheques`

Dado que el usuario puede reintentar (ej: si hubo un error parcial), `guardarCheques` verifica antes de insertar:

```typescript
// Para anticipos:
const { data: existente } = await supabase.schema('msa').from('cheques')
  .select('id').eq('anticipo_id', anticipoId).limit(1)
if (existente && existente.length > 0) return  // Ya registrado, salir

// Para facturas:
const { data: existentes } = await supabase.schema('msa').from('cheques')
  .select('factura_id').in('factura_id', idsFacturas)
const yaExisten = new Set(existentes.map(e => e.factura_id))
const facturasNuevas = facturasACambiar.filter(f => !yaExisten.has(f.id))
if (facturasNuevas.length === 0) return  // Todas ya registradas
```

---

## 7. Cash Flow — ECHEQ

### 7.1. Fecha de posicionamiento

En `useMultiCashFlowData.ts`, cuando una factura o anticipo tiene `metodo_pago === 'echeq'`, se usa `fecha_cobro_echeq` como la fecha del Cash Flow:

```typescript
// Facturas:
const fechaCF = (f.metodo_pago === 'echeq' && f.fecha_cobro_echeq)
  ? f.fecha_cobro_echeq
  : (f.fecha_estimada || calcularFechaEstimada(f.fecha_emision))

// Anticipos: mismo patrón
const fechaCF = (a.metodo_pago === 'echeq' && a.fecha_cobro_echeq)
  ? a.fecha_cobro_echeq
  : (a.fecha_vencimiento || ...)
```

Esto hace que el ítem aparezca en el mes/semana correcto según cuándo el proveedor efectivamente cobra el cheque.

### 7.2. Color de fila

Las filas con estado `'echeq'` se colorean en verde claro para identificación visual:

```tsx
// En vista-cash-flow.tsx, en el className de la fila:
fila.estado === 'echeq' ? 'bg-emerald-50' : ...
```

### 7.3. Estado 'echeq' en filtros

El estado `'echeq'` está incluido en `ESTADOS_DISPONIBLES` y `ESTADOS_ANTICIPO` del Cash Flow:

```typescript
{ value: 'echeq', label: '📝 ECHEQ', color: 'bg-amber-100 text-amber-800' }
```

---

## 8. Panel Gestión de ECHEQs (Cash Flow)

En la vista Cash Flow existe un panel colapsable "📝 Gestión de ECHEQs" que muestra todos los cheques registrados en `msa.cheques`.

### 8.1. Activación

Botón en el header del Cash Flow: "📝 ECHEQs". Al hacer clic carga todos los registros de la tabla `msa.cheques` ordenados por `fecha_cobro`.

### 8.2. Columnas

| Columna | Descripción |
|---------|-------------|
| Banco | Banco emisor |
| Número | Número del cheque (`sin nro` si es NULL) |
| Beneficiario | Nombre del proveedor |
| Monto | Importe del cheque |
| Fecha Emisión | Fecha en que se emitió |
| Fecha Cobro | Fecha de cobro (en rojo si venció y sigue vigente) |
| SICORE | Quincena y monto si corresponde |
| Estado | Select inline: vigente / depositado / cobrado / rechazado |
| Referencia | ID corto de la factura o anticipo vinculado |

### 8.3. Estados de un ECHEQ

| Estado | Significado | Color |
|--------|-------------|-------|
| `vigente` | Emitido, pendiente de depósito | Ámbar |
| `depositado` | El proveedor lo depositó | Azul |
| `cobrado` | Fue acreditado en la cuenta del proveedor | Verde |
| `rechazado` | Fue rechazado (fondos insuficientes, etc.) | Rojo |

El estado se cambia inline con un `<select>` en la tabla. Al cambiar, hace `UPDATE` directo en `msa.cheques`.

### 8.4. Alerta de vencidos

Las filas donde `estado === 'vigente'` y `fecha_cobro < hoy` se resaltan en rojo para indicar que el cheque debería haber sido cobrado ya.

---

## 9. Color del estado 'echeq' en la Vista de Pagos

En el mapa de colores de estado (`colorEstado`):

```typescript
echeq: 'bg-amber-100 text-amber-800 border-amber-300'
```

---

## 10. Refs usados — patrón arquitectónico

El flujo ECHEQ requiere comunicación entre el modal ECHEQ (que vive fuera del IIFE de la sección Pagos) y las funciones internas. Para esto se usan `useRef`:

```typescript
// Referencia a los datos del ECHEQ pendiente de procesar
const echeqPendienteRef = useRef<{
  banco: string; numero: string; fechaEmision: string; fechaCobro: string
} | null>(null)

// Referencia a las funciones del IIFE de pagos
const cambiarEstadoSeleccionadasRef = useRef<((estado: string, echeqFecha?: string) => void) | null>(null)
const cambiarEstadoAnticiposRef     = useRef<((estado: string, echeqFecha?: string) => void) | null>(null)
```

Las funciones se asignan a los refs dentro del IIFE al final de cada renderizado:
```typescript
cambiarEstadoSeleccionadasRef.current = cambiarEstadoSeleccionadas
cambiarEstadoAnticiposRef.current     = cambiarEstadoAnticipoPago
```

El modal ECHEQ, al confirmar, llama a `cambiarEstadoAnticiposRef.current?.()` o `cambiarEstadoSeleccionadasRef.current?.()`.

---

## 11. Diagrama de flujo resumido

```
[Botón ECHEQ en bloque de facturas/anticipos]
        │
        ▼
Modal ECHEQ: banco + número + fecha emisión + fecha cobro
        │
        ▼ Al confirmar:
echeqPendienteRef.current = datos del formulario
cambiarEstadoXXXRef.current('pagar', fechaEmision)
        │
        ├─── ¿Factura desde 'pendiente' con neto > $67,170?
        │         │
        │         ▼
        │    Modal SICORE
        │         │
        │    Al confirmar SICORE:
        │         ├── estado = 'echeq'
        │         ├── metodo_pago = 'echeq'
        │         ├── fecha_cobro_echeq = datos.fechaCobro
        │         └── guardarCheques(factura, datos, sicore)
        │
        └─── ¿Sin SICORE? (ya en 'pagar'/'preparado', Factura C, bajo umbral)
                  │
                  ▼
             estadoEfectivo = 'echeq'
             datosUpdate = { estado: 'echeq', metodo_pago: 'echeq', fecha_cobro_echeq }
             UPDATE comprobantes_arca
             guardarCheques(facturas, datos, null)

Resultado: ítem con estado='echeq', registro en msa.cheques
           aparece en Cash Flow en fecha_cobro_echeq con fila verde
```

---

## 12. Pendientes / mejoras identificadas

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| Completar número ECHEQ al marcar pagado | Media | Cuando se marca 'pagado' un ítem 'echeq', opcionalmente pedir el número si estaba vacío y actualizar `msa.cheques` |
| Email automático con ECHEQ adjunto | Baja | Enviar comprobante al proveedor al emitir |
| Integración Cash Flow → actualizar estado cheque | Baja | Al conciliar extracto bancario, marcar el cheque como 'cobrado' automáticamente |
