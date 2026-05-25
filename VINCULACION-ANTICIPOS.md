# Vinculación de Anticipos a Facturas

> Documentación técnica del módulo de vinculación anticipo → factura.
>
> **Última actualización**: 2026-05-25
> **Commits**: `70eb7d4` (feature + fix SICORE), `2b252ce` (fix Vista Pagos), merge `7beb2ac` (main)

---

## 1. Qué resuelve

Cuando se paga un **anticipo** a un proveedor (por adelantado, o con un ECHEQ) y después existe/llega la factura, vincular el anticipo a la factura:

- **reduce el saldo a pagar** de la factura por el monto del anticipo,
- mantiene la **trazabilidad** (SICORE, descripción, movimiento bancario),
- evita pagar dos veces.

Caso típico: pago de una factura en **2 ECHEQs** (un anticipo + el saldo).

---

## 2. Dónde se usa — dos entradas

### 2.1. Vista Principal — sección "Alertas de Pagos"

- Lista los anticipos sin vincular (`factura_id IS NULL`, `estado != 'vinculado'`, `tipo = 'pago'`).
- Para cada CUIT busca facturas candidatas.
- Botón **"🔗 Vincular"** por anticipo.

### 2.2. Cash Flow — modal "+ Anticipo" (agregado 2026-05-25)

1. **Auto-ofrecer al guardar**: al crear un anticipo de *pago*, si hay facturas pendientes del mismo CUIT → `window.confirm` "¿Vincular este anticipo a una factura ahora?". Si acepta, abre el wizard.
2. **Botón "Vincular"** en la pestaña "Anticipos Existentes" (columna Vinculación), para anticipos `tipo = 'pago'` y `estado != 'vinculado'`.

---

## 3. Arquitectura — módulo compartido

Para no duplicar la lógica, vive en un solo lugar y la usan las dos vistas:

| Archivo | Rol |
|---------|-----|
| `hooks/useVinculacionAnticipo.ts` | Estado + lógica del wizard (`abrirVinculacion`, `onSeleccionarFactura`, `avanzarAConfirmacion`, `volverASeleccion`, `confirmarVinculacion`, `cerrarModal`) + helper `buscarFacturasCandidatas(cuit)` |
| `components/modal-vinculacion-anticipo.tsx` | UI del wizard de 2 pasos (`<ModalVinculacionAnticipo controller={...} />`) |
| `components/vista-principal.tsx` | Consumidor (Alertas de Pagos) |
| `components/vista-cash-flow.tsx` | Consumidor (modal "+ Anticipo") |

El hook recibe un callback `onVinculado` para refrescar los datos al vincular con éxito.

---

## 4. Lógica de vinculación

### 4.1. Candidatos

`buscarFacturasCandidatas(cuit)` → facturas ARCA del CUIT que no están `pagado`/`conciliado` (máx. 10), ordenadas por fecha. Trae también `monto_a_abonar` y `monto_sicore` (necesarios para el cálculo).

### 4.2. Caso A vs Caso B

- **Caso A — factura cubierta**: el anticipo cubre todo lo que falta pagar → la FC pasa a `pagado` (o `conciliado` si el extracto ya estaba conciliado), `monto_a_abonar = neto pagado`.
- **Caso B — pago parcial**: el anticipo cubre una parte → la FC mantiene su estado, se le reduce el `monto_a_abonar` al saldo; el anticipo queda en estado `parcial`.

### 4.3. De dónde viene el SICORE (fix clave — `70eb7d4`)

| Situación | Comportamiento |
|-----------|----------------|
| La **factura** ya tiene SICORE propio (`monto_sicore > 0`) | Se **preserva** (NO se pisa). `saldo = monto_a_abonar_actual − anticipo` |
| La factura **no** tiene SICORE (flujo clásico) | La FC **hereda** el SICORE del anticipo. `saldo = imp_total − anticipo − sicore_anticipo` |

> Sin este branch, una factura con SICORE propio quedaba con el monto mal calculado y se le **borraba** la retención. Ver Arroyo Tala (2026-05-25).

### 4.4. Qué escribe `confirmarVinculacion`

1. **Factura**: `monto_a_abonar` (saldo o neto); en Caso A también `estado`, `fecha_vencimiento`, `fecha_estimada`. Hereda SICORE + descripción→`detalle` **solo si la FC no tenía SICORE propio**.
2. **Anticipo**: `factura_id`, `estado = 'vinculado'` (Caso A) o `'parcial'` (Caso B).
3. **`sicore_retenciones`**: si el anticipo tenía retención, se le agrega `factura_id`.
4. **Extracto bancario**: si el anticipo **ya estaba conciliado** (hay un movimiento que matchea por `anticipo_id`, o por CUIT/monto/categ ANTICIPO), ese movimiento se **re-apunta a la factura** (`comprobante_arca_id`, `categ`, `nro_cuenta`, `detalle`, `estado = 'conciliado'`). Si el anticipo **no pasó por el banco aún → el extracto NO se toca.**

---

## 5. Wizard de confirmación (2 pasos)

- **Paso 1 — Selección**: elegir la factura y ver el preview del cálculo (Total factura, SICORE factura si lo tiene, anticipo aplicado, saldo/neto resultante).
- **Paso 2 — Confirmación**: muestra "lo que va a suceder" y, sobre el extracto, si **detectó un movimiento** (lo muestra y avisa que se actualizará) o **"sin movimiento bancario detectado"**. Recién al apretar **"✅ Confirmar Vinculación"** se escribe en la base. Antes de eso, Cancelar/Atrás no tocan nada.

---

## 6. Vista Pagos — monto a pagar (fix `2b252ce`)

Función única `montoPagoEnPesos(f)` en `vista-facturas-arca.tsx`, usada por el **display**, los **subtotales** y el **PDF** de orden de pago (antes eran 3 fórmulas duplicadas):

```ts
function montoPagoEnPesos(f: FacturaArca): number {
  const tc = f.tc_pago ?? f.tipo_cambio ?? 1
  if (f.moneda === 'USD') {
    return (f.imp_total || 0) * tc - (f.monto_sicore || 0) - (f.descuento_aplicado || 0)
  }
  return f.monto_a_abonar ?? f.imp_total ?? 0   // ARS
}
```

- **ARS** → usa `monto_a_abonar` (ya refleja SICORE, descuento **y anticipos vinculados**).
- **USD** → recalcula `imp_total*tc − sicore − descuento` (evita el doble redondeo de `monto_a_abonar × TC`).

> Antes, Vista Pagos recalculaba `imp_total − sicore` para facturas con SICORE e **ignoraba la reducción por anticipo** (vivía solo en `monto_a_abonar`).

---

## 7. Pendientes / mejoras

| Tema | Descripción |
|------|-------------|
| USD + anticipo | No soportado: la vinculación no convierte moneda entre el anticipo (ARS) y una factura en USD. |
| Flujo 2-ECHEQ | Probado OK (Arroyo Tala, 2026-05-25): crear anticipo (ECHEQ 1) → marcar ECHEQ en Vista Pagos → vincular → pagar el saldo con ECHEQ 2. Ver `ECHEQ.md`. |
