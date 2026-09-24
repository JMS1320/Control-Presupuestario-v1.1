# DISEÑO E IMPLEMENTACIÓN: Módulo SICORE Retenciones

> **Estado**: ✅ IMPLEMENTADO — Core funcional, documentos PDF/email pendientes
> **Fecha diseño**: 2025-09-11
> **Fecha implementación**: 2025-09-11 → 2026-03-05 (mejoras continuas)
> **Archivo principal**: `components/vista-facturas-arca.tsx`
> **Contexto**: Retenciones ganancias AFIP al marcar facturas/anticipos como "pagar"

---

## ✅ Resumen de lo implementado

| Feature | Estado |
|---------|--------|
| Modal interactivo 2 pasos (tipo operación + confirmación) | ✅ |
| 4 tipos operación configurables en BD (`tipos_sicore_config`) | ✅ |
| Cálculo mínimo no imponible por quincena por proveedor | ✅ |
| Lógica primera vs subsecuente retención (mismo CUIT/quincena) | ✅ |
| Campos `sicore` y `monto_sicore` en `msa.comprobantes_arca` | ✅ |
| Campos `sicore` y `monto_sicore` en `anticipos_proveedores` | ✅ |
| Quincena calculada de `fecha_vencimiento` (días 1–15 = 1ra, 16+ = 2da) | ✅ |
| Recálculo quincena al marcar pagado (inline edit + Vista Pagos) | ✅ |
| Botón "Sin SICORE" para saltear en casos que no aplica | ✅ |
| Skip automático Factura C (tipo_comprobante = 11) | ✅ |
| Descuento proporcional (% o monto fijo) con descomposición gravado/IVA | ✅ |
| Panel "Ver Retenciones" — muestra facturas + anticipos por quincena | ✅ |
| Cierre quincena: validación + Excel + PDF generados | ✅ |
| Índice BD `idx_sicore_performance (sicore, cuit)` | ✅ |
| **SICORE v2 — tabla `sicore_retenciones` con FK dual** | ✅ |
| **SICORE v2 para anticipos — `anticipo_id` FK en `sicore_retenciones`** | ✅ |
| **Transferencia anticipo→FC en `confirmarVinculacion`** | ✅ |
| **`resetearAnticipo` — limpia v2 + inline + estado** | ✅ |
| **Botón ↩ revertir pagar→pendiente (Admin only, Vista Pagos)** | ✅ |
| **Exportación TXT ARCA — formato posicional 145 chars (v9.0)** | ✅ |
| **`nro_comprobante` perpetuo + `nro_certificado` por año en `sicore_retenciones`** | ✅ |
| **Guard idempotencia al regenerar TXT (reutiliza nros guardados)** | ✅ |
| **DDJJ SICORE — confirmación + bloqueo post-declaración** | ✅ |
| **Certificado retención — nro_certificado, Orden de Pago global, régimen correcto** | ✅ |
| **Nros asignados al insertar retención (no al cerrar TXT)** | ✅ |
| **Reutilización nro de grupo (cuit+tipo+quincena) para casos multi-factura** | ✅ |

---

## 🏗️ BD — Estructura

### Tabla `tipos_sicore_config` (schema `public`)

```sql
CREATE TABLE tipos_sicore_config (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  minimo_no_imponible DECIMAL(15,2) NOT NULL,
  porcentaje_retencion DECIMAL(5,4) NOT NULL,
  activo BOOLEAN DEFAULT true,
  codigo_regimen VARCHAR(3)   -- código ARCA para TXT posicional
);
```

| id | tipo | emoji | mínimo | % | codigo_regimen |
|----|------|-------|--------|---|---------------|
| 1 | Arrendamiento | 🏠 | $134,400 | 6.00% | 032 |
| 2 | Bienes | 📦 | $224,000 | 2.00% | 078 |
| 3 | Servicios | 🔧 | $67,170 | 2.00% | 094 |
| 4 | Transporte | 🚛 | $67,170 | 0.25% | 095 |

### Campos agregados a `msa.comprobantes_arca`

```sql
ALTER TABLE msa.comprobantes_arca
  ADD COLUMN sicore VARCHAR(20),       -- '26-03 - 1ra' / '26-03 - 2da'
  ADD COLUMN monto_sicore DECIMAL(15,2);

CREATE INDEX idx_sicore_performance ON msa.comprobantes_arca (sicore, cuit);
```

### Campos agregados a `anticipos_proveedores`

```sql
ALTER TABLE anticipos_proveedores
  ADD COLUMN sicore VARCHAR(20),
  ADD COLUMN monto_sicore DECIMAL(15,2),
  ADD COLUMN tipo_sicore VARCHAR(50),
  ADD COLUMN neto_gravado DECIMAL(15,2),
  ADD COLUMN neto_no_gravado DECIMAL(15,2),
  ADD COLUMN op_exentas DECIMAL(15,2),
  ADD COLUMN iva DECIMAL(15,2),
  ADD COLUMN imp_total DECIMAL(15,2);
```

---

## 🔄 Workflow completo

```
1. Factura o anticipo cambia estado → 'pagar'
2. Hook evalúa:
   - Si imp_neto_gravado <= mínimo (tipo Servicios = $67,170) → no activa
   - Si Factura C (tipo_comprobante = 11) → no activa
   - Si usuario eligió "Sin SICORE" previamente → no activa
3. Modal Paso 1: Seleccionar tipo operación (🏠 🔧 📦 🚛)
4. Modal Paso 2 ('calculo'):
   - Tabla desglose: Factura | Descuento (opcional) | Saldo a pagar
   - Columnas: Neto Gravado / IVA / Total
   - Si hay descuento: campo % o monto fijo → descompone proporcional por componente
   - SICORE base = neto ajustado − mínimo no imponible (respeta retenciones previas quincena/CUIT)
   - Botones: Confirmar / Sin SICORE / Cancelar
5. Al confirmar:
   - UPDATE factura/anticipo: sicore='26-03-1ra', monto_sicore=X, estado='pagar'
   - monto_a_abonar actualizado (total − sicore − descuento)
6. Al marcar 'pagado' (inline edit o Vista Pagos):
   - Recalcular quincena desde fecha_vencimiento actual
   - Si cambió → UPDATE sicore en BD
```

---

## 🧮 Lógica cálculo quincena

```typescript
function generarQuincenaSicore(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  const anio = String(d.getFullYear()).slice(-2)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const quincena = d.getDate() <= 15 ? '1ra' : '2da'
  return `${anio}-${mes} - ${quincena}`   // ej: '26-03 - 1ra'
}
```

**Importante**: siempre usar `fecha_vencimiento || fecha_estimada`, nunca solo `fecha_estimada`.

---


## 🧠 LA RETENCIÓN ES DE LA ORDEN DE PAGO, NO DE LA FACTURA *(concepto, 2026-09-13)*

*Enunciado por el usuario al revisar el PDF del Detalle de Pago: **«la retención SICORE se practica
sobre la orden de pago total. El por factura es como el sistema calcula para llegar, pero eso es
subjetivo: se podría haber empezado por otra factura a calcular y serían distintos parciales para el
mismo total»**.*

> **La retención existe UNA sola vez, a nivel de la orden de pago. El reparto por factura es un
> artefacto del cálculo, no un hecho.**

### Por qué el parcial por factura no es real

El cálculo de ganancias es **no lineal**: hay un **mínimo no imponible** que se consume una vez y una
escala que se aplica sobre el acumulado. Entonces, cuando una orden de pago cubre varias facturas:

- la **suma** de los netos y el mínimo superado **determinan el total**, y ese total es único;
- pero **el orden en que se recorren las facturas cambia cuál de ellas "consume" el mínimo**, y por
  lo tanto cambia cuánto le toca a cada una.

🔑 **Mismo total, parciales distintos, según por dónde se empiece.** Un número que depende del orden
de iteración no es un dato del negocio: es un residuo del algoritmo.

### Las tres consecuencias, y las tres obligan

**1 · El TXT de ARCA declara una retención GLOBAL, nunca parciales.** Es la prueba de que el
organismo tampoco reconoce el reparto: lo que se informa es un certificado por orden de pago.

**2 · El certificado también es uno solo.** No hay «certificado de la factura 6347».

**3 · 🛑 Y por eso NO se muestra retención por factura en ningún lado.** Mostrarla invita a sumarla,
a cuadrarla contra la factura y a discutir un número que no significa nada. El lugar de la retención
es el **total de la orden de pago**, y ahí sí es exacta.

### El descuento SÍ es por factura

No confundirlos aunque viajen juntos en la misma pantalla:

| | De quién es | ¿Se puede listar por factura? |
|---|---|---|
| **Descuento** | de **cada factura** — es una condición comercial de ese comprobante | ✅ **sí**, y conviene |
| **Retención de ganancias** | de la **orden de pago** | 🛑 **no**: el parcial es subjetivo |

📌 Y el motivo por el que el descuento sí: es **lineal**. Sumar los descuentos de las facturas da el
descuento total, en cualquier orden. La retención no tiene esa propiedad.

### Dónde impacta esto hoy

→ [A-BUG-173](PENDIENTES.md#a-bug-173): el cuadro 1 del PDF del Detalle de Pago mostraba
`Retención Ganancias` factura por factura. Sale.
## 🧮 Lógica descuento proporcional

Cuando el usuario ingresa un descuento (% o monto fijo):

```typescript
const pct = tipoDescuento === 'pct'
  ? valorInput / 100
  : impTotal > 0 ? valorInput / impTotal : 0

const descGravado   = impGravado   * pct
const descIva       = impIva       * pct
const descNoGravado = impNoGravado * pct
const descExento    = impExento    * pct

// SICORE se recalcula sobre neto ajustado
const netoAjustado = (impGravado - descGravado)
                   + (impNoGravado - descNoGravado)
                   + (impExento - descExento)
const baseAjustada = Math.max(0, netoAjustado - minimoAplicado)
setMontoRetencion(baseAjustada * tipo.porcentaje_retencion)
```

---

## 📊 Panel "Ver Retenciones"

- Selector de quincena → muestra todas las retenciones de esa quincena
- **Fuentes**: `msa.comprobantes_arca` + `anticipos_proveedores` (merge por fecha)
- Badge azul "Anticipo" en filas provenientes de `anticipos_proveedores`
- Columnas: Proveedor / CUIT / Fecha / Estado / Neto Gravado / Retención

**Query anticipos** usa columna `fecha_pago` (no `fecha`).

---

## 🔁 Idempotencia: una fila por comprobante, y el TXT deduplica *(2026-09-11)*

**Dos defensas, y hacen falta las dos.**

### 1 · Al escribir — `lib/sicore/registrar-retencion.ts`

Antes **insertaba a ciegas**. El 10/09 la FC 10-6337 de ALCORTA quedó con **dos filas vigentes
idénticas**, creadas con **0,69 s de diferencia**: el botón «✅ Confirmar y pasar a Pagar» no tenía
guarda de re-entrada y un doble click corrió el flujo entero dos veces.

Ahora sale **sin escribir** si ya existe una fila no anulada con el mismo comprobante + quincena +
tipo **y los mismos importes**.

⚠️ **Los importes entran en la comparación a propósito**: dos pagos parciales legítimos de la misma
factura en la misma quincena tienen distinto `total_pagado` y **no se colapsan**.

🔑 **Va en la capa compartida y no en el botón**: el botón es uno de varios llamadores. Es la
lección de `A-BUG-142` — *la regla vivía en un camino de dos*.

### 2 · Al exportar — `lib/sicore/dedup.ts`

`generarTXTCierreV2` agrupa por `cuit_emisor||tipo_sicore` **sumando fila por fila**, así que una
duplicada se sumaba. Medido sobre el caso real:

| | Pago declarado | Base declarada | Retención |
|---|---:|---:|---:|
| con la duplicada | **$534.631,16** | **$443.138,95** | $1.566,93 |
| correcto | $364.272,27 | $302.346,46 | $1.566,93 |

🧨 **La retención sale bien en los dos casos.** Lo que queda mal es **lo declarado** — por eso
ningún control de plata lo agarraba: el dinero retenido es correcto y el error está en el renglón
de la DDJJ.

🔑 **Sin esta segunda defensa el arreglo no sirve para el caso real**: la primera evita filas
*nuevas*, pero las que ya están en la base se sumarían igual. Y **nada se descarta en silencio**: si
descarta alguna, lo dice por toast.

### 3 · El disparador — la guarda del botón

«Confirmar y pasar a Pagar» usa un `useRef` (no `useState`): el segundo click llega **antes de que
React repinte**. Se libera en `finally`, para que un error no deje el modal muerto.

## 📆 La fecha de pago se escribe con el ESTADO, no antes *(2026-09-11)*

`resolverSicoreLote('retener')` ya **no** escribe la `fecha_pago` de las facturas que van a la cola.
La escribe cada factura al completar su paso, junto con su estado.

**Por qué**: abandonar la cola —cerrar la pestaña, un corte— dejaba la factura con fecha de pago y
con la `fecha_estimada` arrastrada, **pero con el estado viejo**. El Cash Flow proyectaba la plata
saliendo el día del intento y nada lo señalaba (`A-BUG-147`).

🔑 Es el invariante de `A-BUG-20` un paso más adentro: *«nada se escribe hasta que las preguntas
estén contestadas»* valía para el portón, pero **la cola por factura son más preguntas**.

📌 De paso arregla la salida «Cancelar», que restauraba el estado y **dejaba la fecha escrita igual**.

## 🔢 El número de comprobante llega al certificado *(2026-09-11)*

`numero_desde`, `punto_venta` y `fecha_emision` se usaban **sólo para armar el texto de la fila** del
Cash Flow y no viajaban como campos, así que la retención de una factura **suelta** se guardaba sin
número: **11 de 16 filas `origen='directo'`**. `A-BUG-138` lo había arreglado **sólo para el camino
de agrupación**. Ahora viven en el origen (`useMultiCashFlowData`) y sirven para los dos.

⚠️ **Las 11 filas viejas siguen sin número**: el arreglo es hacia adelante. Si hay que reimprimir
alguna de esas quincenas, se completan a mano.

## 📁 Archivos del módulo

| Archivo | Rol |
|---------|-----|
| `components/vista-facturas-arca.tsx` | Todo el módulo SICORE |
| Funciones clave: `generarQuincenaSicore`, `verificarRetencionPrevia`, `evaluarRetencionSicore`, `calcularRetencionSicore`, `finalizarProcesoSicore`, `aplicarDescuentoSicore`, `cargarRetencionesVer`, `procesarCierreQuincena` | |

---

---

## 🏗️ SICORE v2 — Tabla `sicore_retenciones`

### Estructura

La tabla `msa.sicore_retenciones` almacena cada retención calculada con FK hacia el origen del pago. Admite dos tipos de origen:

```sql
-- Columnas relevantes
factura_id    UUID REFERENCES msa.comprobantes_arca(id)      -- nullable
anticipo_id   UUID REFERENCES anticipos_proveedores(id)      -- nullable
-- Una de las dos se llena; ambas cuando el anticipo se vincula a una FC
```

### Flujo anticipo → FC

```
1. Anticipo se pasa a 'pagar' con SICORE
   → INSERT sicore_retenciones (anticipo_id=X, factura_id=NULL, fecha_pago, monto_sicore, ...)

2. FC llega, se llama confirmarVinculacion()
   → UPDATE sicore_retenciones SET factura_id=FC.id
      WHERE anticipo_id=X AND factura_id IS NULL

3. Ahora el registro tiene ambos FK: anticipo_id=X, factura_id=FC.id
   La fecha_pago y montos originales se preservan (no se sobreescriben)
```

### Reset de anticipo (`resetearAnticipo`)

Cuando se revierte un anticipo a `pendiente`:

```typescript
// Solo borra registros NO transferidos (guard factura_id IS NULL)
await supabase.schema(schemaName).from('sicore_retenciones')
  .delete().eq('anticipo_id', anticipo.id).is('factura_id', null)

// Limpia campos inline
UPDATE anticipos_proveedores SET
  estado_pago = 'pendiente',
  sicore = null, monto_sicore = null,
  tipo_sicore = null, monto_restante = null
```

Si el registro ya fue transferido (tiene `factura_id`), no se borra — queda ligado a la FC. El campo `anticipo_id` sigue presente en ese registro como referencia histórica.

### Por qué v1 inline sigue existiendo en anticipos

`anticipos_proveedores` aún tiene columnas `sicore`, `monto_sicore`, `tipo_sicore` para compatibilidad con el hook de quincenas y el panel "Ver Retenciones". Ambos mecanismos (v1 inline + v2 tabla) coexisten.

---

---

## 📤 Exportación TXT ARCA (SICORE v9.0)

### Formato

Archivo de texto plano, **145 caracteres por línea**, `\r\n` como separador. Nombre: `GE_YY_MM{Q}_CUIT.TXT`

| Pos | Largo | Campo | Valor |
|-----|-------|-------|-------|
| 1-2 | 2 | Código comprobante | `06` |
| 3-12 | 10 | Fecha emisión | `DD/MM/YYYY` |
| 13-28 | 16 | Nro comprobante | Right-justified, spaces |
| 29-44 | 16 | Importe comprobante | `SUM(pago)`, coma decimal |
| 45-48 | 4 | Código impuesto | `0217` |
| 49-51 | 3 | Código régimen | De `tipos_sicore_config.codigo_regimen` |
| 52 | 1 | Código operación | `1` |
| 53-66 | 14 | Base de cálculo | `SUM(neto_gravado_pagado)` |
| 67-76 | 10 | Fecha emisión retención | `DD/MM/YYYY` |
| 77-78 | 2 | Código condición | `01` |
| 79 | 1 | Ret. sujetos suspendidos | `0` |
| 80-93 | 14 | Importe retención | `SUM(retencion)` |
| 94-99 | 6 | Porcentaje exclusión | blancos |
| 100-109 | 10 | Fecha publicación | blancos |
| 110-111 | 2 | Tipo documento | `80` |
| 112-131 | 20 | Nro documento retenido | CUIT left-justified |
| 132-145 | 14 | Nro certificado | `0000YYYY{seq6}` |

**Agrupación**: múltiples facturas del mismo `cuit_emisor + tipo_sicore` → **1 línea** con montos sumados.

### Numeración

- **`nro_comprobante`** (BIGINT en `sicore_retenciones`): perpetuo, nunca reinicia salvo overflow a 9,999,999,999,999,999
- **`nro_certificado`** (VARCHAR 14): seq interno reinicia cada año calendario (`0000YYYY000001`), el año cambia automáticamente
- Ambos se guardan en BD al generar el TXT → trazabilidad completa
- **Guard idempotencia**: si todos los registros de la quincena ya tienen `nro_comprobante` → regenera TXT con los números guardados sin recalcular ni sobreescribir

### Función principal

`generarTXTCierreV2(registros, quincena, directorio)` — en `vista-facturas-arca.tsx`

---

## 🔒 DDJJ SICORE — Confirmación y Bloqueo

### Flujo

```
TXT descargado (nro_comprobante asignado, ddjj_confirmada=FALSE)
     ↓ usuario declara a AFIP manualmente
     ↓ regresa a Cierre v2 → banner naranja → "Confirmar DDJJ"
     ↓
ddjj_confirmada=TRUE → 🔒 quincena bloqueada
```

### Campo BD

```sql
ALTER TABLE msa.sicore_retenciones
  ADD COLUMN ddjj_confirmada BOOLEAN DEFAULT FALSE;
```

### Bloqueos activos

- `resetearFactura()`: si algún registro tiene `ddjj_confirmada=TRUE` → alert bloqueante
- `resetearAnticipo()`: ídem
- Regenerar TXT: **permitido** (solo descarga, no modifica `ddjj_confirmada`)

### UI

- Banner **naranja** + botón "✅ Confirmar DDJJ" cuando quincena tiene TXT pero no confirmada
- Banner **gris 🔒** cuando quincena ya declarada
- Ubicación: tab **Cierre v2** del panel SICORE

---

## 🔗 Los templates SICORE se resuelven por LINAJE, no por id fijo (2026-08-27)

Al cerrar una quincena, el modal ofrece las cuotas de los templates SICORE para volcarles **lo
efectivamente retenido**. Esos templates **no se pueden identificar por un `id` fijo.**

**Por qué**: al renovar la campaña (Modelo A, `PENDIENTES.md` § A-FEAT-42) el clon es una **fila
nueva con otro id**, y el original queda como historia. Un `id` hardcodeado apunta para siempre a la
campaña en la que se escribió.

**Cómo se resuelve** (`vista-facturas-arca.tsx`, `linajeTemplates()`):

```
RAIZ_SICORE_1RA / RAIZ_SICORE_2DA   ← la campaña 25/26: el ARRANQUE del linaje, no "el" template
        ↓ template_origen_id
   clon 26/27  →  clon 27/28  →  …   ← se recorre en anchura, generación por generación
```

Se consultan las cuotas de **todos** los templates del linaje, y cada opción del modal muestra **de
qué campaña es** (`1er Quincena · 26/27 | 20/08/2026 — $0`). La preselección es la primera cuota que
vence **después** del cierre de la quincena; si no hay ninguna, cae a la **más futura** disponible —
nunca a la más vieja.

> 🐞 **De dónde salió — [A-BUG-63](PENDIENTES.md#a-bug-63).** El usuario cerró una quincena el
> 2026-08-27 y el modal le ofreció **sólo las 2 cuotas sobrantes de 25/26**, las dos ya vencidas,
> mientras las **24 de 26/27 ya estaban generadas**. Tuvo que cargar la retención a mano.
>
> **Es el segundo lugar donde pega el mismo patrón** — el primero fueron las reglas
> `contable`/`interno`, que también buscaban por `template_id` y quedaban vacías en la campaña nueva.
> La lección: **cualquier código que apunte a un template por `id` tiene fecha de vencimiento — la
> próxima campaña.** Si hay que apuntar a un template concreto, se apunta al **linaje**.
>
> ⚠️ Al barrer el repo (2026-08-27) no quedaban más UUID de template hardcodeados; el único UUID
> fijo que sobrevive es el de la categoría CUT en productivo, ya registrado como
> [A-BUG-48](PENDIENTES.md#a-bug-48).

---

## 🔍 El mínimo consumido DOS VECES — y la firma que lo delata

*Caso real verificado 2026-09-22 sobre el pago de ALCORTA del 10/06/2026 → [A-DAT-55](PENDIENTES.md#a-dat-55).*

> **El mínimo no imponible se consume UNA sola vez por proveedor y por QUINCENA. Si se aplica dos
> veces, la diferencia es siempre el mismo número: `alícuota × mínimo`.**

⚠️ **Corregido 2026-09-22, el mismo día que se escribió**: acá decía *«por mes»*. **El sistema lo
acumula por QUINCENA** — `netoPagosPreviosSinRetencion` compara `generarQuincenaSicore(fecha_pago)`
contra la quincena del pago, y el chequeo de retención previa filtra por `sicore = quincena`. El
caso de abajo no cambia (las tres facturas cayeron en la misma quincena), pero la regla sí.

🛑 **Pero el sistema está MAL y ya está confirmado** *(2026-09-22, [A-DEC-26](PENDIENTES.md#a-dec-26))*:
la RG 830 fija el mínimo **por mes calendario y por sujeto retenido**, y el sistema lo reinicia **cada
quincena**. **La quincena es el período de información y depósito, no la unidad del mínimo** — el
cálculo trata las dos cosas como una.

**Medido**: 2 proveedores reciben el mínimo dos veces en el mismo mes (MASSAGLIA 07/2026 y STRINGHINI
05/2026, los dos de Servicios), y se retuvo **$2.686,80 de menos**. Uno cae en una quincena **ya
declarada**, así que su corrección es una rectificativa. El arreglo es
[A-BUG-193](PENDIENTES.md#a-bug-193).

⚠️ **Sentido del error, que es el contrario del caso de abajo**: acá se retiene **de menos** y la
empresa queda en falta con ARCA; en [A-DAT-55](PENDIENTES.md#a-dat-55) se le pagó de más al proveedor.

Para Bienes eso da **2 % × $224.000 = $4.480,00**, y ese importe es una **firma reconocible**: cuando
una transferencia difiere del registro en exactamente $4.480, no hay que buscar nada más.

**El caso, con los números:**

| Comprobante | Neto | Mínimo aplicado | Base | Retención |
|---|---|---|---|---|
| FC 10-6115 | $882.946,81 | **$224.000** (lo consume entero) | $658.946,81 | $13.178,94 |
| FC 11-2734 | $976.320,00 | 0 | $976.320,00 | $19.526,40 |
| FC 10-6152 | $1.633.768,56 *(neto tras el 5 % de descuento)* | 0 | $1.633.768,56 | $32.675,37 |
| | | | **TOTAL** | **$65.380,71** |

El detalle que se le envió al proveedor llevaba **$60.900,71**, porque la FC 6152 figuraba con
$28.195,37 — el mínimo descontado por segunda vez. **Se transfirieron $4.480,00 de más.**

### Las dos cosas que el caso enseña

**1 · El sistema se corrigió solo, y dejó rastro.** El certificado `00002026000030` quedó **anulado**
y el vigente es el `00002026000034`, ya con los $65.380,71. La tabla guarda las dos versiones, así
que **se puede reconstruir qué se informó en cada momento** — que es exactamente para lo que sirve
no borrar.

**2 · 🛑 La retención certificada NO se toca para que cierre la resta.** Es la tentación obvia
—bajarla a $60.900,71 y que el pago cuadre— y está mal por tres motivos: la quincena está cerrada, el
proveedor se toma el crédito por el importe del certificado, y el TXT ya declarado dice ese número.

> 🔑 **Quien pagó la diferencia fue la empresa.** Al proveedor se le certificó $65.380,71 y se le
> descontó $60.900,71 de la transferencia: los $4.480 salieron del bolsillo propio y son un
> **crédito contra el proveedor**, no un gasto. Van como saldo a favor, nunca adentro de la factura
> → [A-FEAT-168](PENDIENTES.md#a-feat-168).

### Cómo se detecta sin que nadie avise

El cruce que lo encontró es el de la § 🔁 *el mismo número por dos caminos* de `CLAUDE.md`: **el
extracto del banco contra el Cash Flow**, transferencia por transferencia. De cinco pagos a Alcorta,
tres coincidían al centavo y dos no — y ninguna pantalla lo señalaba, porque **todas miran el estado
del pago y ninguna compara el importe transferido contra el registrado**.

## ⚠️ Pendientes / Evolución futura

- **PDF comprobante retención**: Formato AFIP oficial por proveedor
- **Email automático**: Envío PDF al proveedor al confirmar
- **Templates SICORE 60-61**: Llenado automático al cerrar quincena
- **Gestión masiva + SICORE**: Modal unificado para múltiples facturas simultáneas
- **Rectificación DDJJ**: Flujo para modificar quincena ya declarada (desbloquear + generar TXT rectificativo)
- **Gap 28.5 / doble conteo**: Testear con caso real anticipo parcial + FC para validar comportamiento actual
