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
  activo BOOLEAN DEFAULT true
);
```

| id | tipo | emoji | mínimo | % |
|----|------|-------|--------|---|
| 1 | Arrendamiento | 🏠 | $134,400 | 6.00% |
| 2 | Bienes | 📦 | $224,000 | 2.00% |
| 3 | Servicios | 🔧 | $67,170 | 2.00% |
| 4 | Transporte | 🚛 | $67,170 | 0.25% |

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

## 📁 Archivos del módulo

| Archivo | Rol |
|---------|-----|
| `components/vista-facturas-arca.tsx` | Todo el módulo SICORE |
| Funciones clave: `generarQuincenaSicore`, `verificarRetencionPrevia`, `evaluarRetencionSicore`, `calcularRetencionSicore`, `finalizarProcesoSicore`, `aplicarDescuentoSicore`, `cargarRetencionesVer`, `procesarCierreQuincena` | |

---

## ⚠️ Pendientes / Evolución futura

- **PDF comprobante retención**: Formato AFIP oficial por proveedor
- **Email automático**: Envío PDF al proveedor al confirmar
- **Templates SICORE 60-61**: Llenado automático al cerrar quincena
- **Gestión masiva + SICORE**: Modal unificado para múltiples facturas simultáneas
