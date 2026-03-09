# DISEÑO: Módulo Presupuesto + Histórico

> **Estado**: DISEÑO — Pendiente validación antes de implementar
> **Fecha diseño**: 2026-03-05
> **Prioridad**: Alta
> **Alcance inicial**: MSA. PAM en segunda fase.

---

## 🎯 Objetivo

Una vista (o par de sub-vistas) que muestre:
- **Hacia atrás**: lo que realmente ocurrió (libro diario / subdiarios)
- **Hacia adelante**: presupuesto calculado por método (IPC, dólar, template, específico)
- **Hilo conductor**: cuentas contables agrupadas jerárquicamente, mes a mes

---

## 🗺️ Estructura de la vista

```
Columnas: 24 meses (12 pasados → HOY → 12 futuros)
          |← real (gris) →|← presupuesto (verde) →|

Filas: jerarquía colapsable
  ▼ INGRESOS                    [totales por mes]
      ▶ Arrendamientos           [expandible]
          Arrendamiento Rojas
          Arrendamiento SP
      ▶ Venta Cereales
          Venta Soja
          Venta Maíz
  ▼ EGRESOS
      ▶ Impuestos General        [expandible]
          Impuestos ARCA          [expandible]
              Imp. Ganancias MSA  [template → cuotas]
              Anticipo Ganancias  [template → cuotas]
          Impuesto IIBB MSA       [template → cuotas]
          Impuesto Inmobiliario
              Inmobiliario Rojas  [template → cuotas]
              Inmobiliario SP     [template → cuotas]
      ▶ Sueldos                  [expandible]
          Sueldo JMS              [módulo sueldos]
          Sueldo Sigot            [módulo sueldos]
          ...
      ▶ Fijos Buenos Aires MA    [expandible]
          Expensas Libertad       [template]
          AYSA                    [template]
          Metrogas                [template]
      ▶ ...
  ────────────────────────────────
  RESULTADO (Ingresos − Egresos)
```

---

## 🏗️ Jerarquía de filas — dos fuentes unificadas

### Fuente A: Templates (`egresos_sin_factura`)
- Nivel 1: `cuenta_agrupadora` (ej: "Impuestos General")
- Nivel 2: `categ` dentro del agrupador (ej: "Impuestos ARCA")
- Nivel 3: template individual `nombre_referencia` (ej: "Imp. Ganancias MSA")

### Fuente B: Cuentas contables (`cuentas_contables`)
- Nivel 1: cuenta raíz `nro_cuenta` 1 dígito (ej: 4 = RESULTADOS)
- Nivel 2: `nro_cuenta` 2 dígitos (ej: 41 = INGRESOS)
- Nivel 3: `nro_cuenta` 4 dígitos (ej: 4101 = VENTA DE CEREALES)
- Nivel 4: `nro_cuenta` 6 dígitos, `imputable = true` (ej: 410101 = VENTA SOJA)

### Unificación
Las filas de templates y las de cuentas contables **conviven** en la misma vista.
Criterio de ordenamiento:
1. Primero INGRESOS (cuentas contables 4x = ingresos)
2. Luego EGRESOS (templates agrupados)
3. Sueldos (módulo sueldos, su propio agrupador)
4. RESULTADO al final

---

## 📊 Datos por tipo de fila y período

| Tipo fila | Pasado (real) | Futuro (presupuesto) |
|-----------|---------------|----------------------|
| Template fijo | suma cuotas conciliadas/pagadas | suma cuotas proyectadas del template |
| Sueldos | suma pagos realizados | `saldo_pendiente` del período |
| Cuenta contable imputable | libro diario [categ, año, mes] | calculado por método configurado |
| Agrupadora (cualquier nivel) | suma hijos | suma hijos |

---

## 🧮 Métodos de presupuestación (por cuenta/template)

### 1. `template` (default para templates)
- Datos: directamente de `cuotas_egresos_sin_factura` para ese mes
- No requiere configuración adicional
- Para modificar el presupuesto → modificar el template

### 2. `ipc`
```
valor[categ, año, mes] = libro_diario[categ, año-1, mes] × calcular_ipc_acumulado(12 meses)
```
- Usa función `calcular_ipc_acumulado()` ya existente en BD
- Requiere `indices_ipc` cargada (tabla existe, vacía)
- Ejemplo: Expensas Posadas Marzo 2026 = Marzo 2025 × IPC acumulado últimos 12 meses

### 3. `dolar`
```
valor[categ, año, mes] = (libro_diario[categ, año-1, mes] / TC_oficial[año-1, mes]) × TC_oficial[año, mes]
```
- Requiere `tipos_cambio` cargada (tabla nueva)
- Ejemplo: Seguro flota cotizado en USD → se actualiza por TC

### 4. `configurable`
```
valor[categ, año, mes] = libro_diario[categ, año-1, mes] × factor_manual
```
- Factor manual: ej 1.20 = +20%
- Se configura en `presupuesto_config.factor_manual`

### 5. `especifico`
- Valor ingresado manualmente mes a mes en `presupuesto_overrides`
- Para arrendamientos, ventas de granos (fórmula productiva a definir luego)
- Si no hay override → celda vacía o 0

---

## 🗃️ Nuevas tablas BD

### 1. `tipos_cambio`
```sql
CREATE TABLE tipos_cambio (
  id SERIAL PRIMARY KEY,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,           -- 1-12
  tc_oficial DECIMAL(10,4) NOT NULL,
  tc_blue DECIMAL(10,4),
  fuente VARCHAR(50),             -- 'bcra' | 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anio, mes)
);
```

### 2. `libro_diario`
Histórico real por cuenta contable, mes a mes. Se importa desde Excel.

```sql
CREATE TABLE libro_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,           -- 1-12
  categ TEXT NOT NULL,            -- referencia a cuentas_contables.categ
  cuenta_contable TEXT,
  nro_cuenta TEXT,                -- para jerarquía
  cta_totalizadora TEXT,
  monto DECIMAL(15,2) NOT NULL,   -- siempre positivo
  tipo VARCHAR(10) NOT NULL,      -- 'ingreso' | 'egreso'
  empresa VARCHAR(10),            -- 'MSA' | 'PAM'
  fuente VARCHAR(20) DEFAULT 'subdiario',  -- 'subdiario' | 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anio, mes, categ, empresa)
);
```

### 3. `presupuesto_config`
Método de presupuestación por cuenta/agrupador + empresa.

```sql
CREATE TABLE presupuesto_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categ TEXT NOT NULL,            -- cuentas_contables.categ o cuenta_agrupadora templates
  empresa VARCHAR(10) NOT NULL,   -- 'MSA' | 'PAM'
  metodo VARCHAR(20) NOT NULL,    -- 'template' | 'ipc' | 'dolar' | 'configurable' | 'especifico'
  factor_manual DECIMAL(8,4),     -- para método 'configurable' (ej: 1.20)
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(categ, empresa)
);
```

### 4. `presupuesto_overrides`
Valores manuales que pisan el cálculo automático (método 'especifico' + ajustes puntuales).

```sql
CREATE TABLE presupuesto_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  categ TEXT NOT NULL,
  empresa VARCHAR(10) NOT NULL,
  monto DECIMAL(15,2) NOT NULL,
  nota TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anio, mes, categ, empresa)
);
```

---

## 🔢 Lógica cálculo celda (pseudo-código)

```typescript
function getCelda(categ, empresa, anio, mes): { monto: number, fuente: string } {
  const esPassado = (anio < hoy.año) || (anio === hoy.año && mes <= hoy.mes)

  // 1. PASADO → datos reales
  if (esPassado) {
    // a. Buscar en libro_diario
    const real = libro_diario.find({ categ, empresa, anio, mes })
    if (real) return { monto: real.monto, fuente: 'libro_diario' }

    // b. Para templates: suma cuotas conciliadas/pagadas
    const cuotas = cuotas_egresos_sin_factura.sum({ categ, empresa, mes, año: anio, estado: ['conciliado','pagado'] })
    if (cuotas > 0) return { monto: cuotas, fuente: 'template_real' }

    return { monto: 0, fuente: 'sin_datos' }
  }

  // 2. FUTURO → presupuesto
  // a. Override manual primero (siempre pisa)
  const override = presupuesto_overrides.find({ categ, empresa, anio, mes })
  if (override) return { monto: override.monto, fuente: 'override_manual' }

  // b. Template → suma cuotas proyectadas
  const config = presupuesto_config.find({ categ, empresa })
  if (!config || config.metodo === 'template') {
    const cuotas = cuotas_egresos_sin_factura.sum({ categ, empresa, mes, año: anio, estado: 'proyectado' })
    return { monto: cuotas, fuente: 'template_proyectado' }
  }

  // c. Base histórica = mismo mes año anterior
  const base = libro_diario.find({ categ, empresa, anio: anio-1, mes })?.monto ?? 0

  switch (config.metodo) {
    case 'ipc':
      const factorIpc = calcular_ipc_acumulado(anio-1, mes, anio, mes)
      return { monto: base * factorIpc, fuente: 'ipc' }

    case 'dolar':
      const tcBase = tipos_cambio.find({ anio: anio-1, mes })?.tc_oficial ?? 1
      const tcFuturo = tipos_cambio.find({ anio, mes })?.tc_oficial ?? tcBase
      return { monto: (base / tcBase) * tcFuturo, fuente: 'dolar' }

    case 'configurable':
      return { monto: base * (config.factor_manual ?? 1), fuente: 'configurable' }

    case 'especifico':
      return { monto: 0, fuente: 'especifico_sin_valor' }
  }
}
```

---

## 📱 UI — Componente `tab-presupuesto.tsx`

### Layout general
```
[Selector empresa: MSA | PAM]   [Selector año base]   [Botón Config Métodos]

┌─────────────────────────────────────────────────────────────────────────────┐
│                  Ene 25   Feb 25  ...  Mar 26  Abr 26  ...  Mar 27         │
│                  ← real (12 meses) →  ←──── presupuesto (12 meses) ────→   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ INGRESOS       $xxx     $xxx        $xxx    $xxx         $xxx            │
│   ▶ Arrendamientos                                                          │
│   ▶ Venta Cereales                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ EGRESOS        $xxx     $xxx        $xxx    $xxx         $xxx            │
│   ▶ Impuestos General                                                       │
│       ▶ Impuestos ARCA                                                      │
│           Imp. Ganancias   $xxx    $xxx       $xxx    $xxx                  │
│           Anticipo Ganancias                                                │
│   ▶ Impuesto Inmobiliario                                                   │
│   ▶ Sueldos                                                                 │
│   ▶ Fijos Buenos Aires                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ RESULTADO        $xxx     $xxx        $xxx    $xxx                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detalles UX
- Columna "HOY" (mes actual) resaltada con borde/fondo diferente
- Celdas reales: fondo gris claro
- Celdas presupuestadas: fondo verde muy suave
- Hover celda presupuestada → tooltip "Método: IPC / Base: $xxx / Factor: 1.18"
- Click celda presupuestada → modal para override manual (con nota)
- Agrupadores: expandibles, muestran total de hijos
- Sticky primera columna (nombre cuenta) para scroll horizontal

### Modal Config Métodos
Tabla de configuración: fila por cuenta/agrupador → selector método → parámetro adicional

---

## 📥 Importador libro diario

Columnas esperadas del Excel:
```
Mes | Año | Cuenta contable | Nro cuenta | Monto | Tipo (ingreso/egreso) | Empresa
```
*(formato exacto a confirmar cuando el usuario muestre el Excel)*

Ruta API: `POST /api/import-libro-diario`

---

## 🗺️ Fases de implementación

### Fase 1 — Esqueleto (primera sesión)
- [ ] Migraciones BD: 4 tablas nuevas
- [ ] Componente `tab-presupuesto.tsx` con estructura de filas (solo templates, método `template`)
- [ ] Columnas mes a mes, datos de cuotas existentes
- [ ] Tab en dashboard

### Fase 2 — Histórico real
- [ ] Importador libro diario (Excel → BD)
- [ ] Mostrar datos reales en columnas pasadas

### Fase 3 — Métodos IPC + TC
- [ ] Cargar `indices_ipc` (12 meses pasados)
- [ ] Cargar `tipos_cambio` TC oficial
- [ ] Implementar cálculos IPC y dólar

### Fase 4 — Override manual + específico
- [ ] Click en celda futura → modal override
- [ ] Modal Config Métodos por cuenta

### Fase 5 — Ingresos + PAM
- [ ] Fórmulas específicas arrendamientos/ventas
- [ ] Dashboard PAM

---

## ⚠️ Pendientes a definir

- **Formato Excel libro diario**: confirmar columnas exactas cuando el usuario lo muestre
- **Fórmulas específicas ingresos**: arrendamientos (ha × precio quintal × cotización), ventas cereales
- **Tipo de cambio futuro**: ¿el usuario lo carga manualmente mes a mes?
- **¿Sub-vistas o una sola vista?**: por ahora una vista con toggle histórico/presupuesto
- **Sueldos en presupuesto**: usar directamente los datos del módulo sueldos (ya integrado al Cash Flow)

---

## 💡 Sesión 2026-03-09 — Diseño métodos de proyección por cuenta

### Métodos identificados

| Cód | Método | Params adicionales |
|-----|--------|-------------------|
| `ultimo_mes` | Último mes disponible, extender flat | — |
| `ultimo_mes_ipc` | Último mes + IPC mensual proyectado | % IPC mensual esperado |
| `año_atras_ipc` | Mismo mes año anterior + IPC acumulado | — (toma de tabla IPC) |
| `promedio_Nm` | Promedio N meses flat | N = 3, 6 o 12 |
| `promedio_Nm_ipc` | Promedio N meses + IPC desde punto medio del período | N = 3, 6 o 12 |
| `dolares` | Monto fijo en USD × tipo de cambio proyectado | USD amount + TC futuro |
| `manual` | Ingresar cada mes manualmente | — |
| `ventas_ton` | Toneladas × precio/ton | tons + precio/ton por período |

**Nota IPC sobre promedios**: si se promedian N meses, el centro del período está en el mes N/2 aprox. El IPC se aplica desde ese punto medio hasta la fecha proyectada (no el año completo).

### UI propuesta — selector por fila

```
Cuenta contable      | Método           | Config  | Ene  | Feb  | Mar  | ...
---------------------|------------------|---------|------|------|------|
ASESORAMIENTO CONT   | [Último mes ▼]   | —       | 2.5M | 2.5M | 2.5M
PAN AMERICAN ENERGY  | [Prom. 6m+IPC ▼] | 6m      | 68K  | 70K  | 72K
FEDERACION PATRONAL  | [USD ▼]          | $1,200  | 1.2M | 1.2M | 1.2M
VENTAS SOJA          | [Toneladas ▼]    | ✏️      | —    | —    | —
```

Selector compacto a la izquierda de cada cuenta. Params cambian según método elegido.

### ⚠️ Preguntas pendientes a responder antes de implementar

1. **¿Configuración por cuenta o por cuenta + período?** (¿ARCA 2025 usa método X pero ARCA 2026 puede usar método Y?)
2. **¿El presupuesto es por año calendario o campaña?** (julio-junio como las campañas del sistema)
3. **Para ventas en toneladas** — ¿precio y cantidad se cargan una vez al año o cambian mes a mes?
4. **¿Hay cuentas que NO van al presupuesto?** (ej. distribuciones entre socios)

### Estado
- [ ] Responder preguntas anteriores
- [ ] Definir tabla BD para configuración por cuenta
- [ ] Implementar cálculos por método
