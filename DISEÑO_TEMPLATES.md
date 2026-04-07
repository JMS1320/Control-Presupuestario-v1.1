# DISEÑO_TEMPLATES.md — Arquitectura Completa de Templates

> Referencia definitiva para entender los tipos de templates, flags de BD, flujo Pago Manual,
> comportamiento del motor de conciliación, y guards de conciliación manual.

---

## 1. Tres Tipos de Templates

| Tipo | Flag en BD | Descripción |
|------|-----------|-------------|
| **Fijo** | `tipo_template = 'fijo'` | Cuotas con montos y fechas predefinidas. Ej: ARBA, alquiler. |
| **Abierto** | `tipo_template = 'abierto'` | Sin cuotas predefinidas. Cada pago se crea desde "Pago Manual". Tiene una categ fija. |
| **Multi-cuenta** | `tipo_template = 'abierto'` + `es_multi_cuenta = true` | Sin categ en el template. Cada cuota lleva su propia categ al momento de crearse. |

---

## 2. Flags relevantes en `egresos_sin_factura`

| Campo | Tipo | Default | Uso |
|-------|------|---------|-----|
| `tipo_template` | varchar | `'fijo'` | `'fijo'` o `'abierto'` |
| `tipo_recurrencia` | varchar | `'mensual'` | Periodicidad de cuotas |
| `es_bidireccional` | boolean | `false` | FCI, Caja — acepta ingresos y egresos |
| `solo_conciliacion` | boolean | `false` | Solo usa el motor; NO aparece en Pago Manual |
| `es_multi_cuenta` | boolean | `false` | Cada cuota tiene su propia categ |

---

## 3. Campo categ — prioridad cuota sobre template

### Regla global
```
categ efectivo = cuota.categ ?? template.categ
```

Aplica en:
- `useMultiCashFlowData.ts` — construcción de filas Cash Flow
- `useMotorConciliacion.ts` — qué categ se escribe en el extracto
- `vista-templates-egresos.tsx` — columna categ en la tabla

### Campo en BD
```sql
-- En cuotas_egresos_sin_factura
categ VARCHAR(100) NULL
```

- Para templates **fijo** y **abierto** normal: `categ` en cuota siempre NULL. La categ viene del template.
- Para templates **multi-cuenta**: `categ` en cuota es OBLIGATORIA al crear el pago.

---

## 4. Template Multi-cuenta — comportamiento específico

### Wizard — creación
- Solo disponible cuando `tipo_template = 'abierto'`
- Checkbox "📂 Template Multi-cuenta"
- Al activar: limpia y oculta los campos `categ` y `cuenta_agrupadora`
- Se guarda con: `categ = null`, `cuenta_agrupadora = null`, `tipo_recurrencia = 'abierto'`, `es_multi_cuenta = true`

### Pago Manual — paso 2
- Cuando el template seleccionado tiene `es_multi_cuenta = true` → aparece selector de categ
- Categ se selecciona de `cuentas_contables` (datalist)
- Al guardar INSERT en `cuotas_egresos_sin_factura` incluye `categ: categSeleccionada`

### Cash Flow — edición de categ
- Fila con `es_multi_cuenta = false` (cualquier template normal):
  → `toast.error("La categoría de un template solo puede modificarse desde la vista Templates")`
- Fila con `es_multi_cuenta = true`:
  → Escribe en `cuotas_egresos_sin_factura.categ` (no en el template maestro)

### Vista Templates — columna categ
- categ en cuota propia (multi-cuenta): badge **naranja** `bg-orange-100 text-orange-700`
- categ heredada del template: badge **azul** `bg-blue-100 text-blue-700`
- Sin categ: texto naranja italic `"sin categ"`

### Motor de conciliación
- Si `es_multi_cuenta = true` y la cuota no tiene categ:
  → estado = `'auditar'`
  → `motivo_revision = 'Sin categ: requiere asignación de cuenta contable'`

---

## 5. `solo_conciliacion` — templates bancarios/motor

### ¿Qué son?
Templates que **nunca** se pagan manualmente. Su cuota la crea el motor automáticamente
cuando detecta un movimiento bancario con la regla correspondiente (flag `llena_template = true`).

Ejemplos: Comisiones bancarias, IVA bancario, IIBB bancario, Gastos de cuenta, Créditos bancarios.

### Comportamiento en Pago Manual
- **Sección principal**: solo muestra templates con `solo_conciliacion = false`
- **Sección colapsable** "Bancarios / motor": muestra los `solo_conciliacion = true`
  - Botón "↓ Ver bancarios" / "↑ Ocultar" para expandir
  - Cada template muestra badge `SOLO CONCILIACIÓN` en rojo
  - Botón "Habilitar" por cada template → cambia a `solo_conciliacion = false` y lo mueve a la sección principal
- La función `toggleSoloConciliacion` actualiza BD + estado local inmediatamente

---

## 6. Guards de conciliación manual

Se aplican cuando el usuario intenta cambiar estado a `'conciliado'` manualmente
(sin pasar por el motor de conciliación bancaria).

### Vista Templates (`guardarCambio`)
```
Si columna = 'estado' y valor = 'conciliado':
  monto > 0  → alert() bloqueante + cancelar
  monto = 0  → window.confirm() + cancelar si rechaza
```

Mensaje bloqueo (monto > 0):
> "⛔ Esta cuota tiene monto $X.XXX. Para conciliar debe existir un movimiento en el extracto bancario que respalde el pago. Use el motor de conciliación automático."

### Vista Cash Flow (`cambiarEstado`)
```
Si nuevoEstado = 'conciliado' y origen = 'TEMPLATE':
  monto > 0  → toast.error() bloqueante + cancelar
  monto = 0  → window.confirm() + cancelar si rechaza
```

### Razón de ser de los guards
Una cuota con monto > 0 conciliada sin extracto bancario genera un descuadre contable:
el gasto aparece como pagado pero no hay movimiento bancario que lo respalde.
Las cuotas de $0 (placeholder) sí pueden marcarse manualmente ya que no mueven dinero.

---

## 7. Flujo Pago Manual — paso a paso

### Paso 1 — Seleccionar template
1. `abrirModalPagoManual()` carga `cuentas_contables` para el datalist del paso 2
2. Query: templates con `tipo_template='abierto'` (incluye multi-cuenta)
3. Sección principal: `solo_conciliacion = false`
4. Sección colapsable: `solo_conciliacion = true`

### Paso 2 — Ingresar datos del pago
- Campos siempre visibles: fecha, monto, descripción
- Campo categ: **solo aparece** cuando `template.es_multi_cuenta = true`
- Monto: formato es-AR (coma decimal, punto miles)

### Guardar (`guardarPagoManual`)
```sql
INSERT INTO cuotas_egresos_sin_factura (
  egreso_id,           -- template seleccionado
  fecha_vencimiento,
  monto,
  descripcion,
  estado,              -- 'pendiente'
  categ                -- solo si es_multi_cuenta=true
)
```

---

## 8. BD — resumen de campos clave

### `egresos_sin_factura`
```sql
tipo_template        VARCHAR DEFAULT 'fijo'
es_bidireccional     BOOLEAN DEFAULT FALSE
solo_conciliacion    BOOLEAN DEFAULT FALSE
es_multi_cuenta      BOOLEAN DEFAULT FALSE
categ                VARCHAR(100)         -- NULL para multi-cuenta
cuenta_agrupadora    VARCHAR(100)         -- NULL para multi-cuenta
```

### `cuotas_egresos_sin_factura`
```sql
categ                VARCHAR(100)         -- override por cuota (multi-cuenta)
tipo_movimiento      VARCHAR(20) DEFAULT 'egreso'  -- 'egreso' | 'ingreso' (bidireccional)
```

---

## 9. Migración BD requerida

Las siguientes migraciones deben estar aplicadas:

```sql
-- Templates multi-cuenta y solo_conciliacion
ALTER TABLE egresos_sin_factura
  ADD COLUMN IF NOT EXISTS solo_conciliacion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS es_multi_cuenta BOOLEAN DEFAULT FALSE;

-- Categ por cuota
ALTER TABLE cuotas_egresos_sin_factura
  ADD COLUMN IF NOT EXISTS categ VARCHAR(100);

-- Tipo movimiento (bidireccional — FCI, Caja)
ALTER TABLE cuotas_egresos_sin_factura
  ADD COLUMN IF NOT EXISTS tipo_movimiento VARCHAR(20) DEFAULT 'egreso';

-- Bidireccional en templates
ALTER TABLE egresos_sin_factura
  ADD COLUMN IF NOT EXISTS es_bidireccional BOOLEAN DEFAULT FALSE;
```

---

## 10. Archivos principales involucrados

| Archivo | Rol |
|---------|-----|
| `components/wizard-templates-egresos.tsx` | Creación de templates — 3 tipos + flags |
| `components/vista-templates-egresos.tsx` | Vista tabla, inline editing, guards conciliación manual |
| `components/vista-cash-flow.tsx` | Pago Manual modal, guard conciliación manual, toggle solo_conciliacion |
| `hooks/useMultiCashFlowData.ts` | Construcción filas, categ override, categ edit multi-cuenta |
| `hooks/useMotorConciliacion.ts` | Motor, auditar cuando es_multi_cuenta sin categ |

---

## 11. Comportamientos NO permitidos

| Acción | Bloqueada por |
|--------|--------------|
| Conciliar cuota con monto > 0 desde Templates | Guard en `guardarCambio` |
| Conciliar cuota con monto > 0 desde Cash Flow | Guard en `cambiarEstado` |
| Editar categ de template normal desde Cash Flow | Toast.error en `actualizarRegistro` |
| Crear template multi-cuenta con categ en el wizard | Checkbox oculta el campo |
| Template abierto normal sin categ | Validación en `validarPaso` |
| Templates solo_conciliacion en sección principal Pago Manual | Filtro en query UI |
