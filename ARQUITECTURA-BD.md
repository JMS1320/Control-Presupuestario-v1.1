# 🏛️ ARQUITECTURA BASE DE DATOS — Referencia técnica

> **Estado:** al día con la BD viva al **2026-06-23** (regenerado desde `information_schema` + `pg_class`).
> **Fuente de verdad = la BD en Supabase.** Este doc es la lectura humana; el dump exhaustivo de columnas está en **`ESTRUCTURA_BD_COLUMNAS.md`**.
> Cambios estructurales no incluidos en el backup original → ver sección "CAMBIOS POST-RECONSTRUCCIÓN" en `RECONSTRUCCION_SUPABASE_2026-01-07.md`.

---

## 1. Resumen

App de control presupuestario/contable + sector productivo agropecuario. Multi-empresa: **MSA**, **PAM**, **MA**. Backend Supabase (Postgres + PostgREST). Frontend Next.js (cliente supabase-js).

- **60 tablas base** + **6 vistas** (sueldos), en **5 schemas de usuario**.
- Cada empresa tiene su propio schema para lo contable/fiscal; lo **compartido** vive en `public`; lo **agropecuario** en `productivo`.

---

## 2. Schemas

| Schema | Tablas | Propósito |
|--------|:---:|-----------|
| `public` | 22 (+6 vistas sueldos) | **Compartido**: extractos de banco MSA/PAM, templates de egresos, proveedores, cuentas contables, reglas, anticipos, centros de costo, IPC, config, logs, lotes, sueldos (vistas). |
| `msa` | 12 | Contable/fiscal **MSA**: facturas ARCA, históricos, ventas, cajas, cheques, SICORE, grupos de pago, tarjeta. |
| `pam` | 3 | Contable/fiscal **PAM**: facturas ARCA, históricos, tarjeta. |
| `ma` | 4 | Contable/fiscal **MA**: facturas ARCA, ventas, banco (ma_galicia), tarjeta. |
| `productivo` | 19 | **Sector agropecuario**: hacienda, cría/ciclos, terneros, sanidad/aplicaciones, agrícola, insumos. |

### Exposición en API (PostgREST) y acceso desde código
- Los schemas alcanzables por la API deben estar en `pgrst.db_schemas` (aparte de GRANTs/RLS). `public, msa, pam, ma` están expuestos. Ver memoria `reference_schemas_expuestos_api` (el fix de `ma` no está en el backup).
- Cliente: `lib/supabase.ts` crea el client simple. Para schema ≠ public:
  ```ts
  supabase.schema('msa').from('comprobantes_arca')   // ⚠️ .schema() ANTES de .from()
  supabase.from('msa_galicia')                        // public, directo
  ```
  Si `.schema()` va después de `.from()` se ignora (apunta a public) → bug silencioso. Ver memoria `reference_supabase_schema_orden`.
- El motor de conciliación arma el client por `cuenta.schema_bd` (genérico, ya no hardcodeado a msa).

---

## 3. Inventario de tablas

> RLS: ✅ habilitada · ❌ deshabilitada. ⚠️ **OJO**: aun con RLS ✅, casi todas tienen una sola policy *permisiva* "allow all" → no protege. Ver §5.
> Filas = estimado `reltuples` (puede estar desactualizado).

### `public` — compartido
| Tabla | RLS | Filas~ | Propósito |
|-------|:--:|:--:|-----------|
| `msa_galicia` | ✅ | 661 | Extracto cta cte MSA (banco Galicia). Tabla de movimiento bancario. |
| `pam_galicia` | ✅ | 9 | Extracto Caja de Ahorro PAM. |
| `pam_galicia_cc` | ❌ | 20 | Extracto cta cte PAM. |
| `egresos_sin_factura` | ✅ | 156 | **Templates** de egresos (cabecera). 3 tipos: fijo/abierto/bidireccional. |
| `cuotas_egresos_sin_factura` | ✅ | 890 | Cuotas de cada template (detalle). |
| `templates_master` | ✅ | 1 | Agrupador de templates por año. |
| `cuentas_contables` | ✅ | 122 | Plan de cuentas (categ, totalizadora, jerarquía, imputable). |
| `proveedores` | ✅ | 138 | Maestro de proveedores/clientes (CBU, email, mensaje transferencia, flags GAS). |
| `centros_costo` | ✅ | — | Maestro de centros de costo. |
| `reglas_conciliacion` | ✅ | 75 | Reglas del motor (texto→categ/template, por cuenta bancaria). |
| `reglas_contable_interno` | ✅ | — | Reglas contable/interno (por template/responsable). |
| `reglas_ctas_import_arca` | ❌ | — | Reglas CUIT→cuenta contable al importar ARCA. |
| `config_parseo_extracto` | ✅ | — | Config de parseo de extractos por cuenta bancaria. |
| `anticipos_proveedores` | ❌ | 27 | Anticipos a proveedores (pueden vincularse a FC). |
| `anticipos_facturas` | ❌ | — | N:N anticipo↔factura aplicada. |
| `distribucion_socios` | ✅ | — | Config distribución por socio (dashboard). |
| `indices_ipc` | ✅ | — | IPC mensual (ajustes). |
| `tipos_comprobante_afip` | ✅ | 68 | Catálogo tipos comprobante AFIP (NC flag). |
| `tipos_sicore_config` | ✅ | — | Config tipos SICORE (alícuota, mínimo, régimen). |
| `lotes_transferencias` | ❌ | — | Histórico de lotes de pago Galicia (Excel). |
| `arca_descargas_log` | ✅ | — | Log descargas automáticas portal ARCA. |
| `arca_pdf_busqueda_log` | ❌ | — | Log búsqueda automática de PDFs (GAS). |
| **vistas** `sueldos_*` (×6) | — | — | Módulo sueldos expuesto como **vistas**: campanas, empleados, componentes_salario, cuentas_empleado, periodos, pagos. |

### `msa` — contable/fiscal MSA
| Tabla | RLS | Filas~ | Propósito |
|-------|:--:|:--:|-----------|
| `comprobantes_arca` | ✅ | 318 | Facturas de compra ARCA (IVA compras, SICORE, pagos, PDF). |
| `comprobantes_historico` | ❌ | 273 | Facturas históricas pre-sistema. |
| `comprobantes_venta` | ✅ | — | Liquidaciones de venta (granos). |
| `ventas` | ✅ | — | Operaciones de venta (IVA Ventas). |
| `ventas_comprobantes` | ✅ | — | N:N venta↔liquidación. |
| `caja_general` / `caja_ams` / `caja_sigot` | ❌ | 79 | Cajas efectivo (tablas de movimiento). |
| `cheques` | ❌ | — | Cheques/ECHEQs (emisión, endoso, estado). |
| `grupos_pago` | ❌ | — | Grupos de pago (agrupan facturas en una OP). |
| `sicore_retenciones` | ✅ | 39 | Retenciones SICORE (certificados, quincenas, anulación). |
| `tarjeta_visa_business` | ❌ | 320 | Tarjeta VISA Business MSA (resúmenes). |

### `pam` — contable/fiscal PAM
| Tabla | RLS | Propósito |
|-------|:--:|-----------|
| `comprobantes_arca` | ❌ | Facturas ARCA PAM. |
| `comprobantes_historico` | ❌ | Históricos PAM. |
| `tarjeta_visa` | ❌ | Tarjeta VISA PAM. |

### `ma` — contable/fiscal MA
| Tabla | RLS | Filas~ | Propósito |
|-------|:--:|:--:|-----------|
| `comprobantes_arca` | ✅ | 75 | Facturas ARCA MA. |
| `comprobantes_venta` | ✅ | — | Liquidaciones de venta MA. |
| `ma_galicia` | ✅ | 0 | Extracto Caja de Ahorro MA. |
| `tarjeta_visa` | ❌ | 53 | Tarjeta VISA MA. |

### `productivo` — agropecuario
| Grupo | Tablas |
|-------|--------|
| **Hacienda** | `categorias_hacienda`, `movimientos_hacienda`, `stock_hacienda` |
| **Cría / ciclos** | `ciclos_cria`, `detalle_descarte`, `terneros` (209), `pesadas_terneros` (371) |
| **Sanidad/aplicaciones** | `ordenes_aplicacion`, `ordenes_aplicacion_rodeos`, `lineas_orden_aplicacion`, `lineas_orden_labores` |
| **Agrícola** | `lotes_agricolas`, `ordenes_agricolas`, `lineas_orden_agricola`, `lineas_orden_agricola_labores` |
| **Insumos / maestros** | `categorias_insumo` (ambito agrícola/ganadero), `stock_insumos`, `movimientos_insumos`, `labores` |

---

## 4. Patrones transversales

### 4.1 Tablas de movimiento (bancos, cajas, tarjetas) — estructura común
`msa_galicia`, `pam_galicia`, `pam_galicia_cc`, `ma_galicia`, `caja_*`, `tarjeta_*` comparten el núcleo:
`id, fecha, descripcion, debitos, creditos, saldo, control, categ, detalle, contable, interno, centro_de_costo, cuenta, orden, estado, motivo_revision` + la **familia de conciliación** (§4.2).
- **Bancos** agregan: `origen, concepto, grupo_de_conceptos, numero_de_terminal, leyendas_adicionales_1..4, tipo_de_movimiento, numero_de_comprobante, observaciones_cliente`.
- **Tarjetas** agregan: `referencia, cuota, comprobante, debitos_usd, creditos_usd, nro_resumen, fecha_cierre, fecha_vencimiento, tarjeta_adicional, titular_adicional, tipo_fila`.
- **Cajas** son las más simples (no tienen la familia completa: solo `comprobante_arca_id, template_id, template_cuota_id, nro_cuenta`).

### 4.2 Familia de conciliación (columnas de linkeo)
En las tablas de movimiento, al conciliar se llenan (según contra qué se concilie):
`comprobante_arca_id` (factura ARCA) · `template_id` + `template_cuota_id` (template) · `sueldo_pago_id` (sueldo) · `anticipo_id` (anticipo) · `nro_cuenta` (cuenta contable) · `categ`, `detalle`, `contable`, `interno`, `proveedor_nombre`, `comprobantes_pagados`, `estado`.
- ⚠️ Estas columnas **no son FKs** (son UUIDs sueltos, muchos cross-schema). El motor las llena lógicamente.
- ⚠️ Las tablas de **tarjeta** recibieron estas columnas recién en 2026-06 (no estaban; ver `RECONSTRUCCION_SUPABASE`). Las **cajas** aún no tienen `sueldo_pago_id/anticipo_id/proveedor_nombre/etc.`

### 4.3 Estados típicos
- Facturas ARCA `estado`: `pendiente`, `pagar`, `credito` (pagada con tarjeta), `conciliado`, `anterior`, `cuotas`, `debito`, `externo`.
- Movimiento bancario `estado`: `pendiente`, `conciliado`, `auditar`, `total` (fila resumen de tarjeta).
- `ddjj_iva`: `No`, `Imputado`, `DDJJ OK` (DEFAULT `No`, cambiado desde `Pendiente` post-reconstrucción).

---

## 5. Permisos y RLS  🔒

- **Rol `anon`** tiene `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` en **todas** las tablas, y la `anon_key` está en el bundle JS (por diseño). La mayoría de las tablas con RLS ✅ tienen **una sola policy permisiva "allow all"** → **no protege**. Varias tablas directamente sin RLS (ver §3).
- **Riesgo:** cualquiera con `anon_key + curl` puede borrar/truncar tablas. Es el hallazgo crítico de **A-SEC-01** en `PENDIENTES.md` (hardening pendiente).
- Tablas sin RLS hoy: `pam_galicia_cc`, `anticipos_*`, `lotes_transferencias`, `arca_pdf_busqueda_log`, `reglas_ctas_import_arca`, todas las `caja_*`, `cheques`, `grupos_pago`, `comprobantes_historico` (msa/pam), `pam.comprobantes_arca`, todas las `tarjeta_*`, `productivo.terneros`, `productivo.pesadas_terneros`.

---

## 6. Relaciones y jerarquías

### 6.1 FKs reales (constraints en la BD)
```
public.cuotas_egresos_sin_factura.egreso_id      → public.egresos_sin_factura
public.egresos_sin_factura.template_master_id    → public.templates_master
public.egresos_sin_factura.template_origen_id    → public.egresos_sin_factura (self, clonar año)
public.anticipos_facturas.anticipo_id            → public.anticipos_proveedores
public.anticipos_proveedores.factura_id          → msa.comprobantes_arca
public.cuotas_egresos_sin_factura.grupo_pago_id  → msa.grupos_pago
msa.comprobantes_arca.grupo_pago_id              → msa.grupos_pago
msa.sicore_retenciones.factura_id                → msa.comprobantes_arca
msa.sicore_retenciones.anticipo_id               → public.anticipos_proveedores
msa.ventas_comprobantes.{venta_id,comprobante_id}→ msa.ventas / msa.comprobantes_venta
productivo.* → fuertemente normalizado (ciclos→ordenes, lineas→ordenes/stock, stock→categorias, etc.)
```

### 6.2 Links lógicos (SIN FK — los llena el motor/UI)
- Tablas de movimiento → `comprobante_arca_id` (factura, cross-schema), `template_id`+`template_cuota_id` (template), `sueldo_pago_id`, `anticipo_id`. No hay constraint porque cruzan schemas.

### 6.3 Jerarquías por módulo
- **Templates**: `templates_master` → `egresos_sin_factura` (template) → `cuotas_egresos_sin_factura` (cuotas). Cada cuota se concilia contra un movimiento.
- **SICORE**: `sicore_retenciones` cuelga de `comprobantes_arca` (o `anticipos_proveedores`). Quincenas con estado abierta/cerrada/declarada.
- **Anticipos**: `anticipos_proveedores` ↔ `comprobantes_arca` (vía `anticipos_facturas` N:N o `factura_id`).
- **Ventas**: `ventas` ↔ `comprobantes_venta` (N:N vía `ventas_comprobantes`).
- **Grupos de pago**: `grupos_pago` agrupa varias `comprobantes_arca`/`cuotas` en una OP.
- **Productivo (cría)**: `ciclos_cria` referencia 4 órdenes (servicio/tacto/parición/destete); `terneros` → `pesadas_terneros`; `detalle_descarte` → `ciclos_cria`.
- **Productivo (agrícola/sanidad)**: `ordenes_*` → `lineas_orden_*` → `stock_insumos`/`labores`/`categorias`.

---

## 7. Referencias

- **Columnas completas** → `ESTRUCTURA_BD_COLUMNAS.md` (apéndice auto-generado).
- **Cambios no-backup** (ALTERs post-reconstrucción) → `RECONSTRUCCION_SUPABASE_2026-01-07.md` § "CAMBIOS POST-RECONSTRUCCIÓN".
- **Pendientes** → `PENDIENTES.md` (incluye A-SEC-01 seguridad, A-BUG-12 conciliación tarjeta).
- **Diseños por módulo**: `DISEÑO_TEMPLATES.md`, `DISEÑO_SUELDOS.md`, `DISEÑO_SICORE_RETENCIONES.md`, `DISEÑO_TERNEROS.md`, `CONCILIACION-CONTABILIDAD.md`, `VINCULACION-ANTICIPOS.md`.
- **Memorias clave**: `reference_schemas_expuestos_api`, `reference_supabase_schema_orden`, `project_tarjetas_modulo`.

---

## 8. Cómo mantener este doc al día

1. Correr las queries de relevamiento (tablas+RLS, columnas, FKs, vistas — ver `ESTRUCTURA_BD_COLUMNAS.md` para la de columnas).
2. Actualizar inventario (§3) y apéndice cuando se agregan/quitan tablas o columnas.
3. Todo ALTER que no esté en el backup → además registrarlo en `RECONSTRUCCION_SUPABASE`.
