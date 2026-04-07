# DISEÑO E IMPLEMENTACIÓN: Módulo Sueldos

> **Estado**: ✅ IMPLEMENTADO — Operativo, pendiente IPC real
> **Última actualización**: 2026-04-03
> **Fecha diseño**: 2026-03-05
> **Fecha implementación**: 2026-03-05
> **Prioridad**: Alta — reemplaza templates 47-54 del sistema de egresos
> **Contexto**: Módulo independiente con schema propio `sueldos`, integrado al Cash Flow como 4ta fuente

---

## ✅ Resumen de lo implementado

| Feature | Estado |
|---------|--------|
| Schema BD `sueldos` con 6 tablas | ✅ Creado |
| Vistas públicas en schema `public` (workaround PostgREST) | ✅ Creadas |
| Campaña 25/26 sembrada | ✅ |
| 7 empleados con tipos y parámetros | ✅ |
| 3 cuentas bancarias Sigot | ✅ |
| 9 componentes salariales (vigentes desde 2026-02-01) | ✅ |
| 35 períodos Feb–Jun 2026 (7 emp × 5 meses) | ✅ |
| Tab `Sueldos` en dashboard (grid-cols-10) | ✅ |
| Cards resumen: empleados / bruto total / anticipos / saldo | ✅ |
| Navegación por mes (Feb–Jun 2026) | ✅ |
| Mes inicial = mes en curso (clamp al rango disponible) | ✅ 2026-03-25 |
| Tabla empleados del mes: tipo, bruto, anticipos, saldo, estado | ✅ |
| Modal registrar anticipo | ✅ |
| Modal editar anticipo/pago existente | ✅ 2026-03-25 |
| Botón eliminar pago (con confirmación + reversión período) | ✅ 2026-03-25 |
| Modal historial pivot (meses como columnas) | ✅ |
| Cash Flow 4ta fuente (origen `SUELDO`) | ✅ |
| Columnas parámetros por período en BD | ✅ |
| Modal edición parámetros por fila (botón ✏️) | ✅ |
| Preview bruto en tiempo real en modal | ✅ |
| Valor franco editable (default `(A+B)/25`, override manual) | ✅ 2026-03-25 |
| Propagar parámetros a meses siguientes (modal Sí/No) | ✅ 2026-03-25 |
| Campos vacaciones y premio opcionales (suman al bruto) | ✅ 2026-03-25 |
| Campo observaciones por período (visible en tabla principal) | ✅ 2026-03-25 |
| Anticipos en Cash Flow como filas propias (`SUELD ANT`) | ✅ 2026-03-12 |
| Selector estado al registrar anticipo (default `pagar`) | ✅ 2026-03-12 |
| Anticipos editables desde Cash Flow (estado, fecha, monto) | ✅ 2026-03-12 |
| Pagos ordenados por nombre de empleado | ✅ 2026-04-02 |
| Badge medio de pago en tabla de pagos (Banco / Caja) | ✅ 2026-04-02 |
| Selector "Mes al que se imputa" en edición de pago | ✅ 2026-04-02 |
| Cambio de mes reasigna pago entre períodos correctamente | ✅ 2026-04-02 |
| Tipo `plano_ipc` (JMS): campo sueldo en modal ✏️ | ✅ 2026-04-02 |
| `fecha_ingreso` / `fecha_egreso` por empleado | ✅ 2026-04-03 |
| Filtro: empleados solo aparecen en meses activos | ✅ 2026-04-03 |
| Modal Agregar Empleado (todos los campos + genera períodos) | ✅ 2026-04-03 |
| Botón Dar de Baja empleado (setea fecha_egreso) | ✅ 2026-04-03 |
| Campañas dinámicas: mesMin/mesMax desde BD | ✅ 2026-04-03 |
| Modal Gestionar Campañas: lista + crear nueva | ✅ 2026-04-03 |
| Crear campaña genera períodos automáticamente (copia últimos params) | ✅ 2026-04-03 |

---

## 🏗️ Arquitectura de Base de Datos

### Schema `sueldos` — 6 tablas

```
campanas          → ciclos Jul-Jun (ej: '25/26')
empleados         → 7 empleados con tipo y parámetros
cuentas_empleado  → cuentas bancarias por empleado
componentes_salario → montos por empleado + campaña
periodos          → 1 fila por empleado×mes (proyección + tracking)
pagos             → anticipos + sueldos finales + aguinaldo
                    columna `estado` (DEFAULT 'pagar'): pendiente/pagar/programado/pagado/conciliado
```

### Vistas públicas (workaround PostgREST)

Supabase solo expone el schema `public` por defecto. Para que el cliente JS pueda
acceder al schema `sueldos`, se crearon vistas en `public`:

```sql
public.sueldos_campanas            → sueldos.campanas
public.sueldos_empleados           → sueldos.empleados
public.sueldos_cuentas_empleado    → sueldos.cuentas_empleado
public.sueldos_componentes_salario → sueldos.componentes_salario
public.sueldos_periodos            → sueldos.periodos
public.sueldos_pagos               → sueldos.pagos
```

**Importante**: Todos los queries en el código usan las vistas (`sueldos_periodos`, etc.)
y NO usan `.schema('sueldos')`.

> ⚠️ **Cada vez que se agregan columnas a `sueldos.periodos`** hay que recrear la vista:
> ```sql
> DROP VIEW IF EXISTS public.sueldos_periodos;
> -- ALTER TABLE ...
> CREATE VIEW public.sueldos_periodos AS SELECT * FROM sueldos.periodos;
> ```
> No usar `CREATE OR REPLACE` si la columna cambia de tipo (PostgreSQL lo rechaza con error de dependencia).

---

## 📋 Parámetros Editables por Período

Cada período en `sueldos_periodos` tiene sus propios parámetros editables mes a mes.
El usuario los actualiza desde el botón ✏️ en la tabla del mes.

### Columnas de `sueldos.periodos`

| Columna | Tipo | Aplica a | Notas |
|---------|------|----------|-------|
| `monto_a` | NUMERIC | `ab_francos` | Categoría A del convenio |
| `monto_b` | NUMERIC | `ab_francos` | Categoría B del convenio |
| `francos_cantidad` | NUMERIC | `ab_francos` | Días trabajados (admite decimales, ej: 2.5) |
| `valor_franco` | NUMERIC | `ab_francos` | NULL = usa (A+B)/25; si hay valor = override manual |
| `valor_por_dia` | NUMERIC | `por_dia` | |
| `dias_trabajados` | INTEGER | `por_dia` | |
| `valor_por_hora` | NUMERIC | `por_hora_ipc` | |
| `horas_mes` | INTEGER | `por_hora_ipc` | |
| `varios` | NUMERIC | todos | Combustible, reintegros, etc. |
| `vacaciones` | NUMERIC | todos | NULL cuando no aplica |
| `premio` | NUMERIC | todos | NULL cuando no aplica |
| `observaciones` | TEXT | todos | Visible en tabla principal (truncado 40 chars) |

### Fórmulas de cálculo

```
extras = varios + vacaciones + premio

ab_francos:    (A + B) + (valor_franco × francos_cantidad) + extras
               donde valor_franco = monto guardado en BD, o (A+B)/25 si es NULL

por_dia:       valor_por_dia × dias_trabajados + extras
por_hora_ipc:  valor_por_hora × horas_mes + extras
plano_ipc:     bruto_anterior + extras  (IPC pendiente)
```

> **francos = días TRABAJADOS** (no días de descanso). Más francos → más pago.
>
> **valor_franco**: por defecto se calcula automáticamente como `(A+B)/25` y se sincroniza al cambiar A o B. Si el usuario lo edita manualmente, se guarda el valor custom en BD y aparece un botón "↺ Recalcular de A+B" para volver al modo automático. En BD: `NULL` = automático, valor numérico = override.

### Workflow del usuario — actualización mensual

1. Llega la escala del convenio → abre ✏️ → carga nuevo A y B → el valor franco se recalcula solo
2. Carga la cantidad de francos trabajados ese mes (admite decimales como 2,5)
3. Si hubo reintegro combustible u otro concepto esporádico → campo **Varios**
4. Si hubo vacaciones pagadas ese mes → campo **Vacaciones** (suma al bruto)
5. Si hubo premio → campo **Premio** (suma al bruto)
6. Notas del mes → campo **Observaciones** (se ve en la tabla principal)
7. El bruto se muestra en tiempo real antes de guardar
8. Al guardar → UPDATE del período actual → modal pregunta **"¿Propagar a meses siguientes?"**
   - **Sí, propagar**: aplica los mismos parámetros a todos los períodos posteriores del mismo empleado, recalculando `saldo_pendiente` según los anticipos de cada mes
   - **No, solo este mes**: guarda solo el período actual

> **Vacaciones y Premio**: aparecen en la tabla principal como badges de color bajo el nombre del empleado (azul = vacaciones, amarillo = premio). Solo se muestran si tienen valor distinto de cero.
>
> **Observaciones**: aparecen en cursiva gris bajo el nombre. Si supera 40 caracteres se trunca; el texto completo aparece en tooltip al hacer hover.

### Valores iniciales pre-poblados (migración `sueldos_periodos_parametros_mes`)

| Empleado | Valores iniciales cargados |
|----------|---------------------------|
| Sigot | A=1.408.347,10 · B=191.652,90 · francos=5 |
| Barreto | A=0 · B=1.100.000 · francos=4 |
| Alondra | A=0 · B=500.000 · francos=0 |
| Elvio | valor_dia=60.000 · dias=16 |
| Vulcano | valor_dia=80.000 · dias=22 |
| AMS | valor_hora=24.862 · horas=45 |
| JMS | solo varios disponible (plano_ipc pendiente) |

---

## 👥 Empleados y Tipos Salariales

| Nombre | Tipo | Empresa | Parámetros | Vigencia |
|--------|------|---------|-----------|---------|
| Ruben Sigot | `ab_francos` | MSA | 5 francos/mes | activo |
| Wilson Barreto | `ab_francos` | MSA | 4 francos/mes | desde 2026-02-15 |
| Elvio Paz | `por_dia` | MSA | 16 días/mes | activo |
| Fabian Vulcano | `por_dia` | MSA | 22 días/mes | activo |
| JMS | `plano_ipc` | ambas | monto fijo | activo |
| AMS | `por_hora_ipc` | ambas | 45 horas/mes | activo |
| Alondra Olivo | `ab_francos` | PAM | 0 francos/mes | desde 2026-02-15 |
| Alejandro Coria | `ab_francos` | MSA | params vacíos (⚠️ completar ✏️) | hasta 2026-01-31 |
| Ignacio Pucheta | `ab_francos` | MSA | params vacíos (⚠️ completar ✏️) | hasta 2026-01-31 |

**Nota**: Alejandro Coria e Ignacio Pucheta solo tienen período Enero 2026 (su último mes). Bruto = $0, completar parámetros desde ✏️.

---

## 🗓️ Campaña y Períodos

- **Campaña activa**: `25/26` → 2025-07-01 al 2026-06-30
- **Períodos cargados**: Feb–Jun 2026 (5 meses × 7 empleados = 35 períodos)
- **Estado inicial**: `'proyectado'`
- **sueldo_x_ipc**: igual a `bruto_calculado` hasta que se carguen datos IPC reales
  - Tabla a usar: `public.indices_ipc` (anio, mes, valor_ipc)
- **Mes inicial en UI**: mes en curso (clamp a Feb si < Feb, clamp a Jun si > Jun 2026)

---

## 💰 Flujo de Anticipos / Pagos

### Registrar anticipo

1. Modal: empleado + monto + fecha + cuenta destino (opcional) + descripción + estado Cash Flow
2. INSERT en `sueldos_pagos` con `tipo = 'anticipo'`
3. UPDATE `sueldos_periodos`: `anticipos_descontados += monto`, `saldo_pendiente = bruto - anticipos`

### Editar pago existente

- Botón lápiz (✏️) en tabla "Pagos registrados" del mes
- Abre el mismo modal en modo edición, pre-llenado con los datos del pago
- Al guardar: revierte el monto viejo del período, aplica el nuevo → recalcula saldo
- El empleado no se puede cambiar (el pago ya está vinculado al período)

### Eliminar pago

- Botón papelera (🗑) en tabla "Pagos registrados"
- Pide confirmación con el monto
- Revierte `anticipos_descontados` y recalcula `saldo_pendiente` en el período vinculado
- Borra el registro de `sueldos_pagos`

### Filtro "Pagos registrados del mes"

Los pagos se filtran por **`periodo_id`** (el mes al que fue asignado el pago), **no por `fecha`** del pago. Así un pago de febrero efectuado el 5 de marzo aparece en el detalle de febrero. La `fecha` sigue siendo la fecha real del movimiento bancario.

---

## 📊 Integración Cash Flow

**Archivo**: `hooks/useMultiCashFlowData.ts`

### Fuente 1 — Períodos (`sueldos_periodos`)

- Origen: `'SUELDO'`, `categ: 'SUELD'`
- Query: `sueldos_periodos` con join a `sueldos_empleados`, desde 2026-02-01
- Estado `'historico'` excluido
- `debitos` = `saldo_pendiente ?? bruto_calculado`
- `fecha_estimada` = último día del mes del período
- **Solo lectura** desde Cash Flow (`actualizarRegistro` bloquea si `origen_tabla = 'sueldos.periodos'`)

### Fuente 2 — Anticipos (`sueldos_pagos`)

- Origen: `'SUELDO'`, `categ: 'SUELD ANT'`
- Query: `sueldos_pagos` con `tipo = 'anticipo'`, excluye `estado = 'conciliado'`, desde 2026-02-01
- Cada anticipo = 1 fila propia (conciliable con extracto bancario)
- **Editable** desde Cash Flow: estado, fecha, monto, detalle → UPDATE directo en `sueldos_pagos`
- Distinción en `actualizarRegistro`: si `origen_tabla = 'sueldos.pagos'` → editable

---

## 📁 Archivos del Módulo

| Archivo | Rol |
|---------|-----|
| `components/tab-sueldos.tsx` | UI completa del módulo |
| `hooks/useMultiCashFlowData.ts` | 4ta fuente + tipo `'SUELDO'` |
| `dashboard.tsx` | Tab + import |

---

## 🗓️ Gestión de Campañas (2026-04-03)

### Arquitectura

Cada campaña corre de **julio de año X a junio de año X+1**. La tabla `sueldos.campanas` (vista pública `sueldos_campanas`) tiene `activa BOOLEAN`. Al montar el tab se carga la campaña activa y se derivan `mesMin`/`mesMax` dinámicamente — ya no están hardcodeados.

### Crear nueva campaña

Botón **"Campañas"** en el header → modal con:
- Lista de campañas existentes (activa / inactiva)
- Campo etiqueta `AA/AA` (ej: `26/27`) → calcula `fecha_inicio = AAAA-07-01`, `fecha_fin = AAAA-06-30`
- Checkbox "Activar esta campaña" (desactiva la anterior)
- Al confirmar: INSERT campaña + genera períodos para todos los empleados vigentes

### Generación automática de períodos

Para cada empleado con `activo=true` y `fecha_egreso IS NULL OR fecha_egreso >= fecha_inicio_campaña`:
1. Se obtienen sus últimos parámetros conocidos (SELECT más reciente de `sueldos_periodos`)
2. Se generan períodos mes a mes dentro de la campaña, respetando `fecha_ingreso`/`fecha_egreso`
3. El bruto se recalcula con los mismos parámetros del período anterior
4. Se insertan en lotes de 50

### Formato etiqueta

```
"26/27" → anio1=2026, anio2=2027
fecha_inicio = 2026-07-01
fecha_fin    = 2027-06-30
```

---

## 👤 Alta y Baja de Empleados (2026-04-03)

### Columnas nuevas en `sueldos.empleados`

```sql
fecha_ingreso DATE DEFAULT NULL  -- primer día activo
fecha_egreso  DATE DEFAULT NULL  -- último día activo (NULL = sigue activo)
```

Vista `public.sueldos_empleados` recreada para incluir ambas columnas.

### Filtro de visualización

En `cargar()`, los períodos se filtran:
```typescript
// El empleado aparece en el mes si:
// - ingreso <= último día del mes (o no tiene fecha_ingreso)
// - egreso >= primer día del mes (o no tiene fecha_egreso)
```

### Agregar empleado

Botón **"Agregar Empleado"** → modal con:
- Nombre, empresa, tipo sueldo, CUIT, fecha ingreso, fecha egreso
- Parámetros iniciales según tipo (A+B/francos, valor día, valor hora, sueldo base)
- Al guardar: INSERT empleado + genera períodos de la campaña activa donde esté activo

### Dar de baja

Botón **UserMinus** (rojo) en cada fila de empleado → modal con fecha de egreso → `UPDATE sueldos_empleados SET fecha_egreso = ?`. El empleado desaparece automáticamente en meses posteriores a esa fecha.

### Vigencias actuales (BD)

| Empleado | fecha_ingreso | fecha_egreso |
|----------|--------------|-------------|
| Wilson Barreto | 2026-02-15 | NULL |
| Alondra Olivo | 2026-02-15 | NULL |
| Alejandro Coria | NULL | 2026-01-31 |
| Ignacio Pucheta | NULL | 2026-01-31 |
| resto | NULL | NULL |

---

## 🐛 Bugs corregidos (2026-04-03)

| Bug | Causa | Fix |
|-----|-------|-----|
| Monto truncado al editar pago | `replace(/[^0-9.,]/g, '')` dejaba el punto de miles como decimal → parseFloat("1.988.986") = 1.988 | Cambiar a `replace(/\./g, '').replace(',', '.')` en `antMonto` y en función `num()` |
| Franco mostraba 64 en lugar de 64.000 | `num()` tenía el mismo bug de parseo | Mismo fix |
| JMS sin campo sueldo en modal ✏️ | Tipo `plano_ipc` no tenía bloque UI | Agregar bloque + rama en `calcularBruto` + rama en `guardarEdicion` |

---

## 🐛 Bugs corregidos (2026-04-02)

| Bug | Causa | Fix |
|-----|-------|-----|
| Pagos de sueldos no se registraban (falla silenciosa) | Vista `public.sueldos_pagos` no incluía columna `medio_pago` (agregada a `sueldos.pagos` el 2026-03-26 pero la vista nunca se actualizó). El insert enviaba el campo, fallaba en BD, el modal cerraba sin mostrar el error. | `CREATE OR REPLACE VIEW public.sueldos_pagos AS SELECT ... medio_pago FROM sueldos.pagos` |

**Regla importante**: cada vez que se agregue una columna a `sueldos.pagos` o `sueldos.periodos`, hay que recrear la vista pública correspondiente. El código usa `supabase.from('sueldos_pagos')` sin `.schema()` — accede a la vista, no a la tabla directa.

---

## 🐛 Bugs corregidos (2026-03-25)

| Bug | Causa | Fix |
|-----|-------|-----|
| Francos restaban al bruto | Fórmula usaba `-` en vez de `+` | Cambiar a `+` en `calcularBruto` |
| Detalle anticipos filtraba por fecha de pago | Query usaba `fecha BETWEEN` | Cambiar a `periodo_id IN [ids del mes]` |
| Francos no aceptaba decimales | Columna BD era `INTEGER` | Migración: `ALTER COLUMN francos_cantidad TYPE NUMERIC` |
| Mes inicial siempre febrero | Estado hardcodeado a `MES_MIN` | Estado inicializado con fecha actual |

---

## 🔄 Transición: templates viejos de sueldos (47-54) → módulo nuevo

Los templates 47-54 en `egresos_sin_factura` (categ `'SUELD'`) son el sistema viejo.
El módulo `sueldos` (tab Sueldos) es el sistema nuevo. Coexisten por ahora.

**Tareas pendientes del usuario para completar la transición:**
- **A**: Cargar enero 2026 como "Pago Saldo" desde tab Sueldos (botón `+ Saldo`)
- **B**: Corregir o eliminar el anticipo de $0 que cerró incorrectamente un período
- **C**: Re-asignar la fila del extracto bancario que apunta al template viejo
  → En vista Extracto Bancario: botón "Re-asignar" (rojo) o "Vincular" en esa fila
  → Camino B en el modal: buscar template → el motor ya no debería matchear el template viejo
- **D**: Confirmar que los templates 47-54 pueden desactivarse (después de A+B+C)

**Riesgo mientras coexisten**: el motor puede producir duplicados o matches incorrectos
si encuentra tanto la fila del template viejo como la de `sueldos_pagos`.

**Cómo desactivar los templates 47-54** (cuando D esté listo):
```sql
UPDATE egresos_sin_factura
SET solo_conciliacion = true  -- saca del Pago Manual
WHERE categ = 'SUELD';
-- O bien, cambiar estado de todas sus cuotas a 'desactivado'
```

---

## ⚠️ Pendientes / Evolución futura

- **Coria e Pucheta**: Completar parámetros A, B, francos desde ✏️ (bruto actual = $0)
- **Ignacio Pucheta**: Completar CUIT cuando esté disponible
- **IPC real**: Cargar datos en `public.indices_ipc` para calcular `sueldo_x_ipc` real (por ahora = bruto_calculado)
- **plano_ipc (JMS)**: Implementar lógica IPC completa (pendiente, solo varios disponible)
- **Planilla de asistencia**: Reemplazar ingreso manual de francos/días por importación de planilla
- **Cerrar períodos**: Cambiar estado `proyectado → cerrado` al pagar sueldo mensual
- **Aguinaldo**: Agregar lógica semestral (Jun/Dic)
- **Recibos**: Generar PDF recibo de sueldo por empleado
- **Modo histórico**: Períodos anteriores a la campaña activa
- **Wilson Barreto monto_a**: Actualmente $0 — confirmar si corresponde dejar así
- **Editar empleado existente**: No hay UI para modificar nombre/empresa/tipo/CUIT de un empleado ya creado. Usar SQL directo por ahora.
