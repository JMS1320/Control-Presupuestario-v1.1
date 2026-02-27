# DISEÑO: Módulo Agroquímicos — Stock + Órdenes Agrícolas

> **Estado**: DISEÑO COMPLETO — Pendiente implementación
> **Fecha diseño**: 2026-02-27
> **Prioridad**: Media — nueva fase del módulo productivo
> **Arquitectura base**: Replica el sistema veterinario existente adaptado a hectáreas/lotes

---

## 1. Objetivo

Gestionar insumos agroquímicos con el mismo flujo que los veterinarios:
- Stock con compras, ajustes y movimientos
- Órdenes de aplicación vinculadas a lotes agrícolas y hectáreas
- Labores agrícolas asociadas a cada orden
- Export PNG para comunicación (WhatsApp/campo)

---

## 2. Insumos base a crear

| Producto | Unidad stock |
|----------|-------------|
| Glifosato | L |
| Abamectina 3,6% | L |
| Engeo | L |
| Azoxi Pro | L |
| Aceite Vegetal | L |

**Categoría**: `Agroquímico` (nueva en tabla `productivo.categorias_insumo`)

Stock siempre en **litros**. Compras, ajustes y descuento por ejecución de orden usan la misma tabla `movimientos_insumos` y `stock_insumos` que el sistema veterinario.

---

## 3. Labores agrícolas

Agregar a tabla `productivo.labores` con `tipo = 'agricola'`:

| Labor | orden_display |
|-------|--------------|
| Pulverización | 100 |
| Siembra | 101 |
| Fertilización | 102 |
| Cosecha | 103 |

Sistema de agregar labores custom ya existe — el usuario podrá agregar más desde la UI.

---

## 4. Arquitectura de dosis

- **Unidad de ingreso**: L/ha ó cc/ha (usuario elige por línea de insumo)
- **Stock siempre en litros** → conversión automática al calcular total:
  - L/ha: `cantidad_total_L = dosis × hectáreas`
  - cc/ha: `cantidad_total_L = (dosis / 1000) × hectáreas`
- **Cálculo en tiempo real** al ingresar dosis + hectáreas en el modal

**Ejemplos:**
```
Engeo  150 cc/ha × 100 ha = 15,000 cc = 15 L
Glifosato  3 L/ha × 100 ha = 300 L
Azoxi Pro  0.5 L/ha × 50 ha = 25 L
```

---

## 5. Estructura de base de datos

### Migración 1: agregar_categoria_agroquimico

```sql
-- Nueva categoría
INSERT INTO productivo.categorias_insumo (nombre, unidad_medida, activo)
VALUES ('Agroquímico', 'L', true);

-- 5 insumos base con stock = 0
INSERT INTO productivo.stock_insumos (categoria_id, producto, cantidad, unidad_medida)
SELECT id,
  unnest(ARRAY['Glifosato','Abamectina 3,6%','Engeo','Azoxi Pro','Aceite Vegetal']),
  0, 'L'
FROM productivo.categorias_insumo WHERE nombre = 'Agroquímico';
```

### Migración 2: crear_tablas_ordenes_agricolas

```sql
-- Encabezado de orden agrícola
CREATE TABLE productivo.ordenes_agricolas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  lote_id UUID REFERENCES productivo.lotes_agricolas(id),  -- opcional
  lote_nombre VARCHAR(200),   -- fallback si no hay lote cargado en sistema
  hectareas DECIMAL(10,2) NOT NULL,
  estado VARCHAR(20) DEFAULT 'planificada', -- planificada | ejecutada | eliminada
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Líneas de insumos por orden
CREATE TABLE productivo.lineas_orden_agricola (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES productivo.ordenes_agricolas(id) ON DELETE CASCADE,
  insumo_nombre VARCHAR(200) NOT NULL,
  insumo_stock_id UUID REFERENCES productivo.stock_insumos(id),
  dosis DECIMAL(10,4) NOT NULL,       -- valor ingresado por usuario
  unidad_dosis VARCHAR(5) NOT NULL,   -- 'L' ó 'cc'
  cantidad_total_l DECIMAL(10,4),     -- calculado: siempre en litros
  recuento BOOLEAN DEFAULT FALSE,
  cantidad_recuento_l DECIMAL(10,4),  -- litros reales usados al ejecutar
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Labores asociadas a la orden
CREATE TABLE productivo.lineas_orden_agricola_labores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES productivo.ordenes_agricolas(id) ON DELETE CASCADE,
  labor_id INTEGER NOT NULL REFERENCES productivo.labores(id)
);
```

### Migración 3: agregar_labores_agricolas

```sql
INSERT INTO productivo.labores (nombre, tipo, orden_display, activo) VALUES
  ('Pulverización', 'agricola', 100, true),
  ('Siembra',       'agricola', 101, true),
  ('Fertilización', 'agricola', 102, true),
  ('Cosecha',       'agricola', 103, true);
```

---

## 6. Cambios en UI

**Archivo único**: `components/vista-sector-productivo.tsx`

### 6.1 Nuevas interfaces TypeScript

```typescript
interface OrdenAgricola {
  id: string
  fecha: string
  lote_id: string | null
  lote_nombre: string | null
  hectareas: number
  estado: string   // 'planificada' | 'ejecutada' | 'eliminada'
  observaciones: string | null
  created_at: string
  lote?: { nombre_lote: string; hectareas: number }
  lineas?: LineaOrdenAgricola[]
  labores?: string[]
}

interface LineaOrdenAgricola {
  id: string
  orden_id: string
  insumo_nombre: string
  insumo_stock_id: string | null
  dosis: number
  unidad_dosis: string       // 'L' | 'cc'
  cantidad_total_l: number
  recuento: boolean
  cantidad_recuento_l: number | null
  observaciones: string | null
}
```

### 6.2 Restructurar `TabLotesAgricolas` → sub-tabs

La tab actual "Lotes Agrícolas" no tiene sub-tabs. Se convierte en:

```
TabLotesAgricolas
├── Sub-tab "Lotes" → contenido actual (sin cambios)
└── Sub-tab "Órdenes Agrícolas" → nuevo SubTabOrdenesAgricolas()
```

### 6.3 Nuevo componente `SubTabOrdenesAgricolas()`

Espejado de `SubTabOrdenesAplicacion()` (veterinario) con estas diferencias:

**Datos cargados:**
- `ordenes_agricolas` + lote + líneas + labores
- `lotes_agricolas` (para selector opcional)
- `labores` filtradas por `tipo = 'agricola'`
- `stock_insumos` filtrados por categoría 'Agroquímico'

**Modal nueva orden — campos:**
- Fecha (requerido)
- Lote (Select con lotes del sistema, OPCIONAL) → al elegir auto-completa hectáreas
- Hectáreas (input number, siempre editable, requerido)
- Labores: checkboxes filtrados `tipo = 'agricola'` + botón agregar labor custom
- Líneas de insumos:
  - Select insumo (categoría 'Agroquímico') + nombre libre si no está en stock
  - Dosis (input number)
  - Unidad (Select: L/ha | cc/ha)
  - Total calculado en tiempo real → "X.XX L"
- Observaciones

**Helper cálculo:**
```typescript
const calcularTotalL = (dosis: number, unidad: string, hectareas: number): number => {
  const dosisL = unidad === 'cc' ? dosis / 1000 : dosis
  return dosisL * hectareas
}
```

**Flujo guardarOrden:**
1. Validar: hectáreas > 0, al menos 1 insumo con dosis > 0 ó 1 labor
2. INSERT `ordenes_agricolas` con estado 'planificada'
3. INSERT `lineas_orden_agricola` (con `cantidad_total_l` calculado)
4. INSERT `lineas_orden_agricola_labores`

**Flujo ejecutarOrden (modal recuento — igual que veterinario):**
1. Por cada línea: checkbox "se hizo recuento" + cantidad real en L
2. UPDATE `lineas_orden_agricola` (recuento, cantidad_recuento_l)
3. UPDATE `ordenes_agricolas` estado → 'ejecutada'
4. Descontar stock por `insumo_stock_id`:
   - Si recuento marcado → usar `cantidad_recuento_l`
   - Si no → usar `cantidad_total_l`
   - `stock_insumos.cantidad -= total`

**Vista tabla órdenes:**
```
Fecha | Lote | Ha | Labores | N° Insumos | Estado | [PNG] [Ejecutar] [Eliminar]
```

**Export PNG (adaptar función existente):**
- Header: "ORDEN AGRÍCOLA — [fecha]"
- Lote/Campo: [nombre] | [ha] ha
- Labores: [lista]
- Tabla: Producto | Dosis | Unidad | Total (L)
- Footer timestamp

### 6.4 Stock Agroquímicos en `SubTabStockInsumos`

Los agroquímicos aparecen automáticamente al tener categoría "Agroquímico".
Compras, ajustes y movimientos: misma UI y tablas existentes.
**Sin cambios de código en esta sección.**

---

## 7. Ubicación en navegación

```
VistaSectorProductivo
├── Tab Hacienda (sin cambios)
├── Tab Insumos → Stock & Movimientos muestra agroquímicos automáticamente
└── Tab Lotes Agrícolas  ← RESTRUCTURADA
    ├── Sub-tab Lotes (contenido actual sin cambios)
    └── Sub-tab Órdenes Agrícolas (NUEVO)
```

---

## 8. Fases de implementación

| Fase | Descripción |
|------|-------------|
| **1** | 3 migraciones BD (categoría + tablas + labores) |
| **2** | Restructurar TabLotesAgricolas + SubTabLotes sin cambios |
| **3** | Crear SubTabOrdenesAgricolas (modal crear + tabla listado) |
| **4** | Modal ejecutar (recuento + descuento stock) |
| **5** | Export PNG orden agrícola |

**Recomendación**: Implementar todas las fases juntas en una sesión.

---

## 9. Verificación post-implementación

1. BD: tablas `ordenes_agricolas`, `lineas_orden_agricola`, `lineas_orden_agricola_labores` creadas
2. BD: 5 insumos bajo categoría "Agroquímico" visibles en stock
3. BD: 4 labores agrícolas con `tipo = 'agricola'`
4. UI: agroquímicos visibles en "Stock & Movimientos" sin cambios de código
5. Compra de Glifosato → stock sube
6. Crear orden con lote del sistema → hectáreas auto-completan
7. Crear orden sin lote → hectáreas manuales funcionan
8. Cálculo: 150 cc/ha × 100 ha = 15 L ✓ | 3 L/ha × 100 ha = 300 L ✓
9. Ejecutar orden → stock descontado correctamente
10. `npm run build` sin errores

---

**📅 Última actualización:** 2026-02-27
**Estado**: Diseño completo — listo para implementar cuando se decida
