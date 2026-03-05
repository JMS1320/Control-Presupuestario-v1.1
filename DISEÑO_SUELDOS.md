# DISEÑO E IMPLEMENTACIÓN: Módulo Sueldos

> **Estado**: ✅ IMPLEMENTADO — Operativo, pendiente IPC real
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
| Tabla empleados del mes: tipo, bruto, anticipos, saldo, estado | ✅ |
| Modal registrar anticipo | ✅ |
| Modal historial pivot (meses como columnas) | ✅ |
| Cash Flow 4ta fuente (origen `SUELDO`) | ✅ |

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

---

## 👥 Empleados y Tipos Salariales

| Nombre | Tipo | Empresa | Parámetros |
|--------|------|---------|-----------|
| Ruben Sigot | `ab_francos` | MSA | 5 francos/mes |
| Wilson Barreto | `ab_francos` | MSA | 4 francos/mes |
| Elvio Paz | `por_dia` | MSA | 16 días/mes |
| Fabian Vulcano | `por_dia` | MSA | 22 días/mes |
| JMS | `plano_ipc` | ambas | monto fijo |
| AMS | `por_hora_ipc` | ambas | 45 horas/mes |
| Alondra Olivo | `ab_francos` | PAM | 0 francos/mes |

### Fórmulas bruto por tipo

```
ab_francos:    (A + B) - ((A + B) / 25 × francos_dias_promedio)
por_dia:       valor_por_dia × dias_promedio
plano_ipc:     monto_plano  (fijo; IPC solo para comparación)
por_hora_ipc:  valor_por_hora × horas_promedio
```

### Brutoes calculados Feb 2026

| Empleado | Cálculo | Bruto |
|---------|---------|-------|
| Sigot | (1.408.347 + 191.653) - (64.000 × 5) | $1.280.000 |
| Barreto | (0 + 1.100.000) - (44.000 × 4) | $924.000 |
| Elvio | 60.000 × 16 | $960.000 |
| Vulcano | 80.000 × 22 | $1.760.000 |
| JMS | monto plano | $2.415.571 |
| AMS | 24.862 × 45 | $1.118.790 |
| Alondra | (0 + 500.000) - 0 | $500.000 |

---

## 🗓️ Campaña y Períodos

- **Campaña activa**: `25/26` → 2025-07-01 al 2026-06-30
- **Períodos cargados**: Feb–Jun 2026 (5 meses × 7 empleados = 35 períodos)
- **Estado inicial**: `'proyectado'`
- **sueldo_x_ipc**: igual a `bruto_calculado` hasta que se carguen datos IPC reales
  - Tabla a usar: `public.indices_ipc` (anio, mes, valor_ipc)

---

## 💰 Flujo de Anticipos

1. Modal: seleccionar empleado + monto + fecha + cuenta destino (opcional) + descripción
2. INSERT en `sueldos_pagos` con `tipo = 'anticipo'`
3. UPDATE `sueldos_periodos`:
   - `anticipos_descontados += monto`
   - `saldo_pendiente = bruto_calculado - anticipos_descontados`

---

## 📊 Integración Cash Flow

**Archivo**: `hooks/useMultiCashFlowData.ts`

- Origen: `'SUELDO'` (4to en el union type de `CashFlowRow.origen`)
- Query: `sueldos_periodos` con join a `sueldos_empleados`, desde 2026-02-01
- Estado `'historico'` excluido del Cash Flow
- `debitos` = `saldo_pendiente ?? bruto_calculado`
- `fecha_estimada` = último día del mes del período

```typescript
// Edición de registros SUELDO está bloqueada en Cash Flow
// (actualizarRegistro devuelve false inmediatamente para origen 'SUELDO')
```

---

## 📁 Archivos del Módulo

| Archivo | Rol |
|---------|-----|
| `components/tab-sueldos.tsx` | UI completa del módulo |
| `hooks/useMultiCashFlowData.ts` | 4ta fuente + tipo `'SUELDO'` |
| `dashboard.tsx` | Tab + import |

---

## ⚠️ Pendientes / Evolución futura

- **IPC real**: Cargar datos en `public.indices_ipc` para calcular `sueldo_x_ipc` real
  - Por ahora `sueldo_x_ipc = bruto_calculado`
- **Cerrar períodos**: Cambiar estado `proyectado → cerrado` al pagar sueldo mensual
- **Aguinaldo**: Agregar lógica semestral (Jun/Dic)
- **Recibos**: Generar PDF recibo de sueldo por empleado
- **Modo histórico**: Períodos anteriores a la campaña activa
- **Wilson Barreto monto_a**: Actualmente $0 — confirmar si corresponde dejar así
