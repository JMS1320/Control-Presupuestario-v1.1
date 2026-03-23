# CONCILIACIÓN BANCARIA — Documentación Técnica Completa

> **Fecha creación**: 2026-03-22
> **Archivo principal**: `components/vista-extracto-bancario.tsx`
> **Hook motor**: `hooks/useMotorConciliacion.ts`
> **Hook movimientos**: `hooks/useMovimientosBancarios.ts`

---

## 1. TABLAS INVOLUCRADAS

| Tabla | Propósito | Schema |
|-------|-----------|--------|
| `msa_galicia` | Extracto bancario MSA (Galicia) | public |
| `pam_galicia` | Extracto bancario PAM (Galicia) | public |
| `msa.comprobantes_arca` | Facturas ARCA | msa |
| `cuotas_egresos_sin_factura` | Líneas de templates | public |
| `egresos_sin_factura` | Templates (maestro) | public |
| `reglas_conciliacion` | Reglas automáticas de matching | public |
| `anticipos_proveedores` | Anticipos de Cash Flow | public |

### Campos clave de `msa_galicia` / `pam_galicia`:
```
fecha          DATE
debitos        DECIMAL        -- monto salida (positivo)
creditos       DECIMAL        -- monto entrada (positivo)
saldo          DECIMAL
descripcion    TEXT
estado         VARCHAR        -- 'Pendiente' | 'conciliado' | 'auditar'
categ          VARCHAR        -- cuenta contable (ej: 'IMP 1', 'SUELD')
centro_de_costo VARCHAR
contable       TEXT           -- imputación contable
interno        TEXT           -- imputación interna
detalle        TEXT
motivo_revision TEXT
orden          INT
```

---

## 2. ESTADOS DE UN MOVIMIENTO BANCARIO

```
   [IMPORT]
      │
      ▼
  'Pendiente'  ◄──────────────────────────────┐
      │                                        │
      ├─► Motor auto: fecha exacta + monto     │
      │   ──────────────────────────────────►  'conciliado'
      │                                        │
      ├─► Motor auto: fecha ±5 días + monto    │
      │   ──────────────────────────────────►  'auditar'
      │                                        │
      ├─► Motor auto: regla descripción/CUIT   │
      │   ──────────────────────────────────►  'conciliado'
      │                                        │
      └─► Manual (edición masiva)               │
          ──────────────────────────────────►  cualquier estado

```

**Notas importantes:**
- Los estados se pueden cambiar manualmente en cualquier momento
- No existe estado "archivado" ni "definitivo" — son siempre editables
- `'auditar'` significa: el motor encontró un match probable pero necesita revisión humana

---

## 3. FLUJO DE IMPORTACIÓN (carga extracto)

1. **Archivo Excel** desde el banco → subido en vista Extracto Bancario
2. **API** `app/api/import-excel/route.ts`:
   - Parsea filas Excel
   - Determina `saldo_inicio` (último saldo previo o ingresado manualmente)
   - Calcula `saldo` acumulado por movimiento
   - Calcula columna `control` = diferencia entre saldo calculado y saldo del banco
   - Inserta en `msa_galicia` con `estado = 'Pendiente'`

**Fix crítico aplicado** (2026-01-10): Procesar extracto en orden cronológico (oldest→newest). Sin este fix el `control` daba errores de millones.

---

## 4. MOTOR DE CONCILIACIÓN AUTOMÁTICA

**`hooks/useMotorConciliacion.ts` → `ejecutarConciliacion()`**

### Fase 1: Matching por Cash Flow

Compara el monto del movimiento bancario contra el agregado del Cash Flow (templates + facturas en estado "Pago"):

```
if (cf.debitos === movimiento.debitos) {
    diferenciaDias = |fecha_CF - fecha_movimiento|

    si diferenciaDias === 0  →  estado = 'conciliado'
    si diferenciaDias ≤ 5   →  estado = 'auditar'
}
```

**Importante:** el match es por monto exacto contra el AGREGADO del Cash Flow, no contra una factura individual.

### Fase 2: Reglas de Conciliación

Si no matcheó en Fase 1, aplica las reglas de `reglas_conciliacion` en orden:

```
Campos de búsqueda: descripcion, cuit, monto_debito, monto_credito
Tipos de match: exacto | contiene | inicia_con | termina_con
→ Primera regla que coincide gana
→ Aplica: categ, centro_costo, detalle
→ Marca como 'conciliado'
```

### Resultado del motor:
```
{
  total_movimientos: N,
  automaticos: N,        // conciliados por fecha exacta o regla
  revision_manual: N,    // estado 'auditar'
  sin_match: N,          // siguen en 'Pendiente'
  errores: N
}
```

---

## 5. CONCILIACIÓN MANUAL — PROCESO COMPLETO

### 5.1 Propuestas Inteligentes

Para cada movimiento, el sistema genera un ranking de candidatos:

| Prioridad | Tipo | Criterio |
|-----------|------|---------|
| 1 | ARCA Factura | Monto exacto |
| 2 | Template/Cuota | Monto exacto |
| 3 | ARCA Factura | Monto ±10% + mismo proveedor |
| 4 | Template/Cuota | Monto ±10% + mismo proveedor |
| 5 | ARCA Factura | Mismo proveedor (cualquier monto) |
| 6 | Template/Cuota | Mismo proveedor (cualquier monto) |

Las ARCA tienen prioridad sobre templates cuando el monto es igual.

**Búsqueda manual**: por denominación_emisor, CUIT, tipo+número comprobante, descripción, monto.

### 5.2 Campos editables en conciliación manual

Al seleccionar un movimiento (o varios en modo masivo):

```
categ           → cuenta contable (se valida contra cuentas_contables)
centro_de_costo → centro de costo
contable        → imputación contable manual
interno         → imputación interna manual
detalle         → descripción libre
estado          → 'conciliado' | 'auditar' | 'Pendiente'
vincular_a      → opción: ARCA factura o Template (opcional)
```

### 5.3 Lo que sucede al confirmar conciliación

**Siempre se actualiza el movimiento bancario:**
```sql
UPDATE msa_galicia SET
    estado = 'conciliado',
    categ = editData.categ,
    centro_de_costo = editData.centro_de_costo,
    contable = editData.contable,
    interno = editData.interno,
    detalle = editData.detalle,
    motivo_revision = NULL
WHERE id = movimiento.id
```

**Si se vinculó a una ARCA Factura:**
```sql
UPDATE msa.comprobantes_arca SET
    estado = 'conciliado',
    monto_a_abonar = movimiento.debitos,   -- si diferencia ≤10% o confirma
    cuenta_contable = editData.categ,      -- solo si categ no está vacía y es válida
    centro_costo = editData.centro_de_costo
WHERE id = factura.id
```

**Si se vinculó a un Template/Cuota:**
```sql
UPDATE cuotas_egresos_sin_factura SET
    estado = 'conciliado',
    monto = movimiento.debitos
WHERE id = cuota.id

UPDATE egresos_sin_factura SET
    categ = editData.categ,
    centro_costo = editData.centro_de_costo
WHERE id = cuota.egreso_id
```

### 5.4 Validaciones aplicadas

**Categoría:** se valida contra la tabla `cuentas_contables`. Si no existe → no se asigna (sin error bloqueante, pero cuenta_contable queda sin cambios en la factura).

**Diferencia de monto (±10%):**
```
si |debitos_extracto - monto_factura| / monto_factura > 10%
→ Pide confirmación al usuario antes de actualizar monto_a_abonar
```

---

## 6. PREGUNTA CLAVE: ¿QUÉ PASA CON `cuenta_contable` VACÍA?

### Escenario: movimiento conciliado pero factura sin cuenta contable

```
CASO A: El usuario asigna categ al conciliar
────────────────────────────────────────────
Movimiento bancario → categ = 'IMP 1'
    │
    └─► Se propaga HACIA la factura ARCA:
        comprobantes_arca.cuenta_contable = 'IMP 1'  ← SE ACTUALIZA AHORA

CASO B: El usuario NO asigna categ al conciliar
────────────────────────────────────────────────
Movimiento bancario → categ = NULL
    │
    └─► comprobantes_arca.cuenta_contable NO SE TOCA
        (queda como estaba: NULL o el valor previo)

```

### ⚠️ Propagación es UNI-DIRECCIONAL

**La propagación va de extracto → factura, nunca al revés.**

| Acción | Efecto sobre factura | Efecto sobre extracto |
|--------|---------------------|----------------------|
| Conciliar extracto con categ ingresada | cuenta_contable ← categ | estado ← 'conciliado' |
| Conciliar extracto sin categ | cuenta_contable no cambia | estado ← 'conciliado' |
| Editar cuenta_contable en vista ARCA después | cuenta_contable ← nuevo valor | **extracto NO se actualiza** |
| Re-conciliar el extracto manualmente | cuenta_contable ← categ nueva | estado ← 'conciliado' |

### Flujo de trabajo recomendado

**Opción 1 — Asignar categ al momento de conciliar (recomendado):**
1. En Extracto → seleccionar movimiento → vincular a factura ARCA
2. En el campo "Categoría" del editor → ingresar la cuenta contable
3. Confirmar → se actualiza tanto el extracto como la factura en un solo paso

**Opción 2 — Si ya se concilió sin categ y después se quiere agregar:**
1. No hay propagación automática
2. Opciones: (a) editar la factura en ARCA directamente; (b) volver al extracto, re-editar el movimiento conciliado y poner la categ

**No existe mecanismo automático** que detecte "la factura fue actualizada → actualizar el extracto". Es una limitación actual de la arquitectura.

---

## 7. EDICIÓN MASIVA (BULK)

Permite seleccionar múltiples movimientos con checkbox y aplicar los mismos valores a todos:

- Útil para categorizar lotes (ej: 10 movimientos de ARBA → todos categ 'IMP 1')
- Cada movimiento puede o no estar vinculado a una factura/template
- La propagación a facturas/templates aplica individualmente a cada uno

**Acceso:** botón "Gestión Masiva" / modo selección en la vista.

---

## 8. FILTROS DISPONIBLES EN VISTA EXTRACTO

- Por estado: Pendiente / conciliado / auditar / todos
- Por banco/cuenta: MSA Galicia / PAM Galicia / etc.
- Por fecha (rango)
- Por monto (desde / hasta)
- Por texto (descripción)
- Ver solo débitos / solo créditos / todos

---

## 9. COLUMNA "CONTROL"

Calculada en el importador:

```
control[i] = saldo_banco[i] - saldo_calculado[i]

donde saldo_calculado[i] = saldo_calculado[i-1] + creditos[i] - debitos[i]
```

- **Control ≈ 0**: extracto importado correctamente
- **Control con diferencia**: error en importación (orden cronológico incorrecto, fila faltante, etc.)

---

## 10. CUENTAS BANCARIAS CONFIGURADAS

| Nombre | Empresa | Tabla BD |
|--------|---------|---------|
| MSA Galicia CC Pesos | MSA | `msa_galicia` |
| PAM Galicia CA Pesos | PAM | `pam_galicia` |
| PAM Galicia CC Pesos | PAM | `pam_galicia_cc` |

Las tres tablas están en el schema `public`. Configuradas en `CUENTAS_BANCARIAS` dentro de `hooks/useMotorConciliacion.ts`.

Para agregar nuevas cuentas: crear tabla con mismo schema en `public` + agregar entrada en `CUENTAS_BANCARIAS`.

### Selector de cuenta en la vista

El header de Extracto Bancario muestra un botón siempre visible:
- Sin cuenta seleccionada → "Seleccionar cuenta"
- Con cuenta seleccionada → nombre de la cuenta activa

Al clickearlo abre el Dialog selector. La tabla activa se pasa al hook `useMovimientosBancarios(tablaActiva)`, que recarga automáticamente al cambiar.

---

## 11. ARQUITECTURA MULTI-SCHEMA (MSA / PAM)

### Schemas en Supabase

| Schema | Contenido | Acceso desde código |
|--------|-----------|---------------------|
| `public` | Extractos bancarios + todas las tablas compartidas | `supabase.from('tabla')` |
| `msa` | Facturas ARCA empresa MSA | `supabase.schema('msa').from('tabla')` |
| `pam` | Facturas ARCA empresa PAM | `supabase.schema('pam').from('tabla')` |

### ⚠️ Problema resuelto (2026-03-22): schema `pam` devolvía HTTP 406

**Síntoma**: Vista Facturas PAM mostraba "Error al cargar facturas: Invalid schema: pam".

**Causa raíz**: PostgREST mantiene su propia lista interna `pgrst.db_schemas` en el rol `authenticator`. El Dashboard de Supabase ("Exposed Schemas") tenía `pam` configurado visualmente, pero el valor real en PostgreSQL nunca se actualizó.

**Verificación que confirmó el problema**:
```sql
SELECT rolconfig FROM pg_roles WHERE rolname = 'authenticator';
-- Resultado: pgrst.db_schemas=public, msa, productivo, sueldos
-- ← pam no estaba en la lista
```

**Fix aplicado**:
```sql
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, msa, productivo, sueldos, pam';
NOTIFY pgrst;
```

**Lección**: El Dashboard de Supabase puede mostrar un schema como configurado sin que el valor real en PostgreSQL se haya actualizado. Si un schema da 406, verificar siempre `SELECT rolconfig FROM pg_roles WHERE rolname = 'authenticator'` antes de buscar causas más complejas.

---

## 12. ARCHIVOS CLAVE

| Archivo | Propósito |
|---------|-----------|
| `components/vista-extracto-bancario.tsx` | Vista principal + UI conciliación manual |
| `hooks/useMotorConciliacion.ts` | Motor automático (matching CF + reglas) + `CUENTAS_BANCARIAS` config |
| `hooks/useMovimientosBancarios.ts` | CRUD movimientos bancarios — acepta `tabla` como parámetro |
| `app/api/import-excel/route.ts` | Import extracto Excel → BD |
| `app/api/import-excel-dinamico/route.ts` | Import genérico multi-tabla |
| `components/configurador-reglas.tsx` | CRUD reglas de conciliación automática |

---

## 13. PLAN DE CUENTAS — CONSISTENCIA

### Dos sistemas de categ actualmente en uso

| Sistema | Fuente | Estilo | Ejemplo |
|---------|--------|--------|---------|
| `cuentas_contables` | Facturas ARCA | Plan contable con nro_cuenta | `INTERESES` (422132) |
| `egresos_sin_factura` | Templates | Descriptivo operativo | `Tarjetas MSA`, `Impuesto inmobiliario` |

Las categ de `reglas_conciliacion` fueron creadas antes del plan de cuentas actual y **no coinciden con ninguno de los dos sistemas**. Pendiente unificar contra las categ de templates (ver PENDIENTES-PROXIMA-SESION.md C4).

### nro_cuenta en extractos (implementado 2026-03-23)

Las tablas de extracto (`msa_galicia`, `pam_galicia`, `pam_galicia_cc`) ahora tienen columna `nro_cuenta VARCHAR(20)`.

**Motivación**: pueden existir dos cuentas con el mismo nombre descriptivo pero distinto número. El `nro_cuenta` es el identificador único y no ambiguo del plan de cuentas.

**Flujo**: al seleccionar una categ en la edición masiva del extracto, el `CategCombobox` devuelve también el `nro_cuenta` correspondiente (si existe en `cuentas_contables`) y lo persiste junto con la categ.

**Estado en otras tablas**:
- ✅ `msa.comprobantes_arca` — tiene `nro_cuenta` (implementado previamente)
- ✅ `comprobantes_historico` — tiene `nro_cuenta` (implementado previamente)
- ✅ `msa_galicia` / `pam_galicia` / `pam_galicia_cc` — tiene `nro_cuenta` (implementado 2026-03-23)
- ⚠️ `egresos_sin_factura` / `cuotas_egresos_sin_factura` — pendiente agregar `nro_cuenta`

### CategCombobox (actualizado 2026-03-23)

- Carga **`cuentas_contables` como fuente maestra** (ordenada por nro_cuenta)
- Muestra el nro_cuenta junto a cada opción en el dropdown
- Prop `onSelectFull(categ, nro_cuenta)` para capturar ambos valores
- Fuentes secundarias (templates, extractos) aparecen debajo como "Sin número de cuenta"
- **Fix**: bug previo consultaba columna `codigo` inexistente — corregido a `categ`

---

## 14. LIMITACIONES ACTUALES (A DESARROLLAR)

1. **Sin propagación inversa**: si se edita cuenta_contable en la factura ARCA después de conciliar, el extracto no se actualiza automáticamente.

2. **Sin tabla de vínculos explícita**: no existe una tabla `reconciliation_links` que registre "movimiento X fue vinculado con factura Y". Los vínculos son implícitos (se actualizan los campos de la factura/cuota en el momento de conciliar, pero no queda un registro estructurado del link).

3. **Sin historial de cambios de estado**: un movimiento puede pasar de 'conciliado' a 'Pendiente' sin dejar traza.

4. **Re-apertura no revierte cambios en factura**: si se "desconcilia" un movimiento manualmente, la factura vinculada NO revierte automáticamente a su estado anterior.

5. **Reglas de conciliación desincronizadas**: las categ en `reglas_conciliacion` no coinciden con `cuentas_contables` ni con `egresos_sin_factura`. Pendiente unificación.
