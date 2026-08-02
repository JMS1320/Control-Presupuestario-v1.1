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

---
---

# 🌾 INGRESOS — Arrendamientos agrícolas (diseño cerrado 2026-07-26)

> **Estado**: DISEÑO CERRADO — pendiente aprobación del DDL antes de tocar BD (MCP en read-only).
> **Fuente**: `exports_app/- Desarrollo Presuesto..xlsx` (solapa "Primeros Pasos") + sesión 2026-07-26.
> **Alcance**: MSA primero. PAM y MA se replican después (insertar filas, no migrar).

## 🧭 Decisión arquitectural (la más importante)

**El presupuesto de ingresos NO se carga en Presupuesto.** Se carga como **Ventas**, y Presupuesto lo lee.

Cita del usuario (celda B19 de la planilla): *"La estrategia siempre fue: **Venta origina Factura/Liquidación que origina Cobro**"*.

> ### ⚠️ Corrección de modelo (2026-07-26) — LA FIJACIÓN ES LA VENTA
> La primera versión de este diseño decía *"al fijar se genera el comprobante"*, razonando
> como si el comprobante fuera el hecho principal. **Es al revés**: la fijación **es** la
> venta; el comprobante (factura/liquidación) viene **después**. Por eso la tabla se llama
> `ventas_arrendamiento` (antes `fijaciones_arrendamiento`): **cada fijación —total o
> parcial— es una venta**.
>
> **Estructura de Ventas** (sub-solapas dentro de Ingresos), tal como la planteó el usuario:
> ```
> Ventas
>  ├── Arrendamiento   contratos → cuotas → FIJAR (= vender)   ← public.ventas_arrendamiento
>  ├── Granos          msa.ventas (ya existía, vacía)
>  └── Ganadería       (pendiente — solapa Ganadería del Excel)
>         ↓ las tres
>    Comprobantes (factura/liquidación) → Cobros → Conciliación
> ```
> Ya existe `msa.ventas_comprobantes` (N:N venta↔comprobante). Arriba de las tres irá una
> vista SQL `ventas_unificadas` (fecha, tipo, cliente, monto, cuenta contable, centro de
> costo) — que es donde las tres sí son iguales — para que la consuman Cash Flow y el motor.
> Se descartó una única tabla `ventas` con campo `tipo`: las tres tienen forma genuinamente
> distinta (arrendamiento: cuota/posición/qq-ha · granos: corredor/puerto/COE · ganadería:
> cabezas/categoría/kg) y quedarían treinta columnas nulables sin nada que valide nada.

### 🕐 La fijación son DOS momentos: precio y TC

Fijar el **precio** (USD/ton) y fijar el **TC** son actos distintos y pueden pasar en momentos
distintos. La venta **nace al fijar el primero de los dos**; hasta que estén ambos, el monto en
USD ya es cierto pero **el monto en pesos es estimado** (se proyecta con el TC del mes de cobro
y la celda queda marcada con `*`).

**Excepción**: modo `pizarra` (disponible) cierra en **un solo acto**, en pesos, **sin TC**.

| Estado de la venta | Significa |
|---|---|
| `sin_precio` | existe la venta pero falta fijar el precio |
| `sin_tc` | precio fijado, falta el TC → monto en pesos estimado |
| `cerrada` | ambos fijados (o pizarra con su precio en pesos) → monto exacto |

### ✂️ Fijación parcial: se PARTE la cuota

**Invariante: una cuota se fija entera o se parte.** Al fijar parcialmente, la cuota original
queda con lo que se vendió y **el saldo pasa a una cuota nueva** (`cuota_padre_id` apunta a la
original). Así cada cuota tiene una sola fecha, un solo precio y un solo destino, y el saldo se
puede **mover y valorizar por su cuenta**. Los qq se reparten proporcionalmente, con lo que el
guardarraíl `Σ qq = qq_ha_total` sigue cerrando.

Patrón: **una sola fila que nace presupuestada y se vuelve real** — el mismo que ya usan las cuotas de
templates (`proyectado` → … → `conciliado`). No hay copia ni migración entre "mundo presupuesto" y
"mundo real": la cuota cambia de estado.

```
contrato_arrendamiento          (Ventas — BBDD fuente)
  └ cuota_arrendamiento         estado: presupuestado
      │                         tons × precio Matba(posición) × TC   ← proyección, recalcula sola
      │  ← FIJÁS (total o parcial)
      ▼
    fijacion_arrendamiento      tons · precio_usd · tc  ← CONGELADOS, no se recalculan más
      └→ comprobante en {schema}.comprobantes_venta = la factura
         └→ motor rama VENTA → cobro → conciliación → retenciones_recibidas (dato real)
```

**Por qué congelar el precio en la fijación**: cuando después corregís la tabla de precios, no se te
reescribe el pasado — sólo cambian las cuotas todavía no fijadas. Mismo criterio que Cash Flow con
facturas en USD.

### Schemas — decisión: TODO en `public`
Se evaluó un schema `presupuesto` para agrupar. **Descartado**:
- Cada schema nuevo hay que exponerlo en `pgrst.db_schemas` aparte de GRANTs/RLS (mordió con `ma`,
  ver [[reference_schemas_expuestos_api]]) y no queda en el backup.
- `.schema()` debe ir **antes** de `.from()` o se ignora en silencio (bug del motor de conciliación).
- Contratos/cuotas son **tablas de Ventas**, no de presupuesto; TC/IPC/precios son **datos macro**
  multiempresa que también usa Ventas para el precio real. Un schema `presupuesto` contendría cosas
  que no son de presupuesto.
- El orden lo da `ARQUITECTURA-BD.md`, no el namespace.

### NO se crea tabla de campos
Los campos ya existen como **centros de costo** (`public.centros_costo`: Nazarenas, Rojas, Lima ✓).
Y las hectáreas **no son del campo sino del contrato** — Nazarenas tiene 144,93 ha para MSA y
211,16 ha para PAM. El contrato apunta a `centro_costo` y listo.

---

## 📐 Fórmulas (extraídas de la planilla)

```
Tons_total  = has × qq_ha_total / 10          (E6 = C6*D6/10)      [output]
Tons_cuota  = has × qq_ha_cuota / 10          (E7 = C$6*D7/10)     [output]
pct_cuota   = qq_ha_cuota / qq_ha_total       (C7 = D7/D$6)        [output, informativo]
Monto_cuota = Tons_cuota × Precio_USD(posición) × TC(mes)          [output]
disponible  = Tons_cuota − Σ fijaciones.tons                       [output]
```

**INPUTS** (lo único que se tipea): `has`, `qq_ha_total`, y por cuota `fecha_cobro`,
`qq_ha_cuota`, `posición`. Más dos series macro: precios de soja y TC.

**Guardarraíl** (verificado en los 4 contratos: 15 · 24 · 15 · 15,5 ✓):
`Σ qq_ha_cuota = qq_ha_total`. Es **advertencia**, no bloqueo (mismo criterio que
[[project_generador_renovacion_templates]]).

⚠️ La **fecha de cobro y la posición de fijación son independientes**: en la planilla hay una cuota
que se cobra el 20/04/27 con posición 5/27. El precio sale de la **posición**; la fecha define el
**flujo de caja**.

---

## 📊 Datos de origen — campaña 26/27

| Empresa | Campo | Has | Arr. total | Tons | Cliente |
|---|---|---:|---:|---:|---|
| MSA | Nazarenas | 144,93 | 15 qq/ha | 217,395 | Provinvest |
| MSA | Rojas | 242 | 24 qq/ha | 580,80 | Sanpa |
| PAM | Nazarenas | 211,16 | 15 qq/ha | 316,74 | Provinvest |
| MA | Lima | 84 | 15,5 qq/ha | 130,20 | Provinvest |

> La planilla titula "MA 26/27" sobre los dos últimos, pero **contablemente Nazarenas es PAM** y
> sólo Lima es MA.

**Cuotas 26/27:**
- MSA Nazarenas: 6qq→20/11/26 (pos 11/26) · 1,5qq→20/11/26 (pos 5/27) · 7,5qq→20/04/27 (pos 5/27)
- MSA Rojas: 6,6→10/07/26 (7/26) · 6,6→10/11/26 (11/26) · 2→10/11/26 (11/26) · 8,8→10/05/27 (5/27)
- PAM Nazarenas: mismo esquema que MSA Nazarenas
- MA Lima: 7,75→20/11/26 (11/26) · 7,75→20/04/27 (5/27)

**Campaña 27/28**: se replica la misma estructura corriendo las fechas un año; el usuario corrige
después. (Objetivo: dejar 2 campañas cargadas para que Presupuesto las refleje.)

---

## 🎯 Estados y reglas de movimiento

| Estado cuota | ¿Se puede mover? | Precio |
|---|---|---|
| `presupuestado` (posición Matba) | Sí, **sólo hacia adelante** | posición Matba del mes destino |
| `disponible` (no fijada, vencida o liberada) | Sí, cualquier dirección · piso **hoy + 20 días** | idem |
| `parcial` | la parte no fijada se mueve; la fijada no | mixto |
| `fijado` | **NO** — ya generó factura | congelado |

**Por qué mover**: es una herramienta de **simulación financiera** — *"¿qué pasa si la cobro ahora
o la guardo hasta enero?"*. Ej.: la cuota está en noviembre, la movés a enero y toma el precio
Matba de enero como referencia (Rosario no tiene futuros).

- **R1** — Al mover, la **posición pasa a ser el mes destino**. Se guarda la fecha/posición
  original para el botón **"volver a default"** (mismo patrón que templates).
- **R2** — Fijación **parcial permitida** → por eso la fijación es una **fila hija**, no un estado.
- **R3** — Modo `pizarra`: **fecha_cobro = fecha_fijación + 20 días corridos**. Sólo aplica a
  disponibles; cuando fijás contra posición Matba manda la fecha contractual.
- **R4** — Precio faltante en un mes → tomar el **siguiente mes cargado** y **marcar la celda**
  (arrastrado, no cargado).
- **R5** — Al mover una cuota también se le asigna precio, pero eso es **proyección**: no genera
  factura. La factura nace **sólo al fijar**, y ahí la cuota se congela.
- **R6** — **Exento de IVA**. Todo neto.

---

## 💸 Deducciones e impuestos

### Ganancias 6%
Se **descuenta del cobro** (menor ingreso), calculado **sobre el neto**. Se registra en su cuenta
contable. Por ahora **no** se engancha con `retenciones_recibidas` — mejora futura para cuando se
quiera recuperar contra el impuesto.

### IIBB — son DOS cosas distintas, no mezclar

**(A) Retención de IIBB sufrida** — ocurre **en el cobro**. El arrendatario retiene y esa plata no
entra. **NO se presupuesta**: se carga sólo cuando ocurre el pago y le informan lo retenido.
Va a `retenciones_recibidas` (dato real). Al cargarse, **descuenta el pago de IIBB del mes siguiente**.

**(B) Pago mensual de IIBB al fisco** — ocurre el **mes siguiente al cobro**. Es el 5% del neto,
menos las retenciones (A) del mes.

```
Cobro (mes N)        = Bruto − ret. IIBB sufrida (A) − 6% ganancias      → entra menos
Pago IIBB (mes N+1)  = 5% del neto (B) − ret. IIBB sufridas del mes N    → sale menos
```

> La regla B13 de la planilla (*"para cada cobro se paga 5% de IIBB el mes siguiente"*) es **(B) sin
> contemplar (A)**. Si hay retención, el pago del mes siguiente es menor o el presupuesto
> sobreestima el egreso.

### Dónde se registra el IIBB (B) — DECIDIDO: en el template
**Se vuelca a la cuota del template IIBB Mensual del mes siguiente al cobro** → se ve en
Presupuesto **y** en Cash Flow.

Motivo: las cuotas del template ya existen mensualmente en $0. No volcarlo no es "no mostrarlo",
es **mostrar un cero que es mentira**. Verificado: template **"IIBB Mensual MSA"**
`fba5c3f9-c915-46ca-a5b5-492c8943031e` (categ `Impuesto IIBB`, agrupadora `Impuestos General`),
cuotas mensuales al día 15, casi todas $0 salvo junio ($3.554.217,73). Existe el par PAM
(`848b07e3`).

**Patrón: el de SICORE** (`vista-facturas-arca.tsx:5053` `confirmarAsignacionCuotaSicore` +
`lib/sicore/registrar-retencion.ts` + `resetear-retencion.ts`), o sea:
- **explícito, nunca silencioso** — la app calcula y ofrece volcar;
- **idempotente** — recalcular no duplica;
- **con reset** — si cambia la cuota de venta, se recalcula/revierte;
- **gatillable desde Ventas o desde Presupuesto**, escribiendo siempre en el mismo lugar.

**Traza sin ALTER**: la cuota se marca en `detalle` = `"Auto: 5% arrendamientos · N cobros ·
recalculado dd/mm"`. Si el usuario escribe un monto a mano (sin esa marca), el recálculo **no lo
pisa**. Estados existentes alcanzan (`pendiente`, etc.); no hay estado `proyectado` en
`cuotas_egresos_sin_factura`.

> ⚠️ `KNOWLEDGE.md` tiene la lección "Templates Auto-Modificables — DEMASIADO COMPLEJO" (2025-08):
> *"los templates pierden su rol de presupuesto limpio"*. Por eso el volcado es **explícito + reset**,
> no automático y silencioso. Se respeta el espíritu de la lección sin dejar el cero mentiroso.

---

## 🗃️ DDL propuesto (a aprobar antes de aplicar)

```sql
-- 1) TIPO DE CAMBIO (macro, multiempresa)
CREATE TABLE public.tipos_cambio (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio             integer NOT NULL,
  mes              integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  tc_presupuestado numeric(12,4),
  tc_real          numeric(12,4),
  fuente           varchar(20) DEFAULT 'manual',
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (anio, mes)
);

-- 2) PRECIOS DE GRANOS por posición (macro). Una sola serie: Matba en USD.
--    La pizarra Rosario NO es serie: es precio puntual congelado en la fijación.
CREATE TABLE public.precios_granos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grano       varchar(20) NOT NULL DEFAULT 'soja',
  anio        integer NOT NULL,
  mes         integer NOT NULL CHECK (mes BETWEEN 1 AND 12),  -- posición
  precio_usd  numeric(12,2) NOT NULL,
  fuente      varchar(20) DEFAULT 'manual',   -- 'manual' | 'matba'
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (grano, anio, mes)
);

-- 3) CONTRATOS
CREATE TABLE public.contratos_arrendamiento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa         varchar(10) NOT NULL,          -- 'MSA' | 'PAM' | 'MA'
  campania        varchar(10) NOT NULL,          -- '26/27'
  centro_costo    text        NOT NULL,          -- FK lógica a centros_costo.nombre
  cliente_cuit    varchar(13),
  cliente_nombre  varchar(200) NOT NULL,         -- Sanpa | Provinvest
  has             numeric(10,2) NOT NULL,
  qq_ha_total     numeric(8,2)  NOT NULL,
  grano           varchar(20) DEFAULT 'soja',
  cuenta_contable text DEFAULT 'ARRENDAMIENTOS Venta',   -- 4109 (imputable, ya existe)
  activo          boolean DEFAULT true,
  notas           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
-- tons_total = has * qq_ha_total / 10   → CALCULADO, no se persiste

-- 4) CUOTAS
CREATE TABLE public.cuotas_arrendamiento (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id           uuid NOT NULL REFERENCES public.contratos_arrendamiento(id) ON DELETE CASCADE,
  numero_cuota          integer NOT NULL,
  qq_ha_cuota           numeric(8,2) NOT NULL,
  fecha_cobro_estimada  date NOT NULL,
  posicion_anio         integer NOT NULL,
  posicion_mes          integer NOT NULL CHECK (posicion_mes BETWEEN 1 AND 12),
  -- para "volver a default" tras mover la cuota
  fecha_cobro_original  date,
  posicion_orig_anio    integer,
  posicion_orig_mes     integer,
  estado                varchar(20) NOT NULL DEFAULT 'presupuestado',
                        -- presupuestado | parcial | fijado | disponible
  notas                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE (contrato_id, numero_cuota)
);
-- tons_cuota = contrato.has * qq_ha_cuota / 10        → CALCULADO
-- pct_cuota  = qq_ha_cuota / contrato.qq_ha_total     → CALCULADO
-- disponible = tons_cuota - SUM(fijaciones.tons)      → CALCULADO

-- 5) FIJACIONES (fila hija: permite fijación parcial)
CREATE TABLE public.fijaciones_arrendamiento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuota_id        uuid NOT NULL REFERENCES public.cuotas_arrendamiento(id) ON DELETE CASCADE,
  fecha_fijacion  date NOT NULL,
  tons            numeric(12,3) NOT NULL,
  modo            varchar(10) NOT NULL,       -- 'matba' | 'pizarra'
  precio_usd      numeric(12,2),              -- congelado (modo matba)
  precio_pesos    numeric(15,2),              -- congelado (modo pizarra, ARS directo)
  tc              numeric(12,4),              -- congelado
  monto_pesos     numeric(15,2) NOT NULL,
  fecha_cobro     date NOT NULL,              -- pizarra: fecha_fijacion + 20 días corridos
  comprobante_id  uuid,                       -- FK lógica a {schema}.comprobantes_venta
  created_at      timestamptz DEFAULT now()
);
```

**Nota sobre `comprobante_id`**: es FK **lógica**, sin constraint, porque los comprobantes viven en
schema por empresa (`msa.comprobantes_venta`, `ma.comprobantes_venta`; **PAM todavía no tiene**) y
el schema sale de `contrato.empresa`.

**`msa.comprobantes_venta` ya sirve tal cual** — tiene `toneladas`, `modo_precio`, `precio_usd`,
`tc`, `precio_pesos`, `cuenta_contable`, `centro_costo`, `estado`, `fecha_cobro_estimada`,
`moneda`, y está enganchada al motor rama VENTA. No se toca.

**Falta**: `indices_ipc` existe pero está **vacía** (0 filas). Hay que cargarla.

---

## 📱 UI

### Ventas (BBDD fuente)
- ABM de contratos (empresa · campaña · centro de costo · cliente · has · qq/ha).
- Grilla de cuotas con `tons`, `%`, fecha de cobro, posición, estado, disponible.
- Acción **Fijar** (permite parcial): tons a fijar + modo + precio + TC → congela y genera comprobante.
- Acción **Mover** (sólo no fijadas, respetando R1/R3) + **Volver a default**.

### Presupuesto — 3 filas por campo
```
▼ INGRESOS
  ▼ Nazarenas (MSA)
      Fijado                 ← real, precio cerrado, con factura
      Presupuestado          ← tons × Matba(posición) × TC
      Disponible a fijar     ← tons sin fijar, valuadas a Matba del mes destino
  ▼ Rojas (MSA)
      ...
▼ EGRESOS
  ▶ Impuestos General
      IIBB Mensual MSA       ← 5% de los cobros del mes anterior (volcado al template)
```

### Cash Flow
Ve lo **fijado** como ingreso comprometido y la cuota de **IIBB** como egreso. Es la contraparte
que hoy le falta (Cash Flow ve egresos y casi nada de ingresos). El movimiento de cuotas se puede
hacer **desde Cash Flow**, pero como **interfaz**: escribe en la cuota de Ventas. Fuente única.

---

## 🗺️ Fases

1. **BD** — 5 tablas + carga de `indices_ipc`.
2. **Ventas** — ABM contratos + cuotas + carga de las 2 campañas MSA.
3. **Precios/TC** — ABM de `precios_granos` y `tipos_cambio` (carga manual).
4. **Fijación** — parcial, congelado, generación de comprobante, cadena al motor VENTA.
5. **Presupuesto** — 3 filas por campo + fila IIBB derivada.
6. **IIBB** — `lib/iibb/` con volcado explícito + reset (patrón SICORE).
7. **Cash Flow** — ingresos fijados + edición de cuotas como interfaz.
8. **Replicar** a PAM y MA (incluye crear `pam.comprobantes_venta`).

## 🔮 Mejoras diferidas (anotadas, fuera de alcance)

- **Precios automáticos** de Matba/Rofex (hoy carga manual, corrección esporádica).
- **Ganancias 6% ↔ `retenciones_recibidas`** para recuperarlo contra el impuesto.
- **Hoja1 de la planilla** — mapa grande sin abordar: agrícola por lote (CD/seguro/cosecha/rinde),
  cría (% preñez/destete), recría por margen, costos de estructura, reinversión, amortización,
  dividendos, y "aprovechar data vieja de subdiarios/tarjetas/AFIP".
