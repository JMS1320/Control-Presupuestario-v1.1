# CONCILIACIÓN + CONTABILIDAD — Documentación Técnica Completa

> **Fecha creación**: 2026-03-22 | **Renombrado**: 2026-03-23 | **Última actualización**: 2026-03-24
> **Archivo principal**: `components/vista-extracto-bancario.tsx`
> **Hook motor**: `hooks/useMotorConciliacion.ts`
> **Hook movimientos**: `hooks/useMovimientosBancarios.ts`

---

## 0. ARQUITECTURA CONTABLE INTEGRAL

Todo el sistema de registro contable se construye desde tres grupos de origen que convergen en un único registro de ingresos y gastos:

### Grupo 1 — Facturas ARCA
- **Qué son**: gastos e ingresos que informa AFIP/ARCA (facturas de proveedores y clientes)
- **Dónde se registran**: `msa.comprobantes_arca` / `pam.comprobantes_arca`
- **Cuenta contable**: campo `cuenta_contable` + `nro_cuenta` del plan de cuentas formal (`cuentas_contables`)
- **Usos**: subdiario IVA para DDJJ mensual + primer bloque contable de ingresos/gastos

### Grupo 2 — Templates
- **Qué son**: gastos que ARCA no informa (impuestos provinciales, sueldos, expensas, tarjetas, distribuciones, seguros, etc.)
- **Dónde se registran**: `egresos_sin_factura` / `cuotas_egresos_sin_factura`
- **Cuenta contable**: campo `categ` del template (plan de cuentas de templates — hoy nomenclatura separada, pendiente unificar)
- **Carga**: manual o semi-manual por el usuario
- **Conciliación**: se cruzan contra débitos del extracto bancario (y en el futuro contra caja)

### Grupo 3 — Gastos bancarios automáticos
- **Qué son**: gastos que surgen directamente del extracto bancario: comisiones bancarias, impuestos bancarios (IIBB, Débitos/Créditos, IVA bancario, etc.), FCI, CAJA, tarjetas
- **Dónde se registran**: en las tablas de extracto (`msa_galicia`, `pam_galicia`, `pam_galicia_cc`) + en su **template correspondiente** (cuota abierta creada automáticamente)
- **Cuenta contable**: asignada automáticamente por las **reglas de conciliación** según descripción del movimiento — cada categ de regla es ahora idéntica a la categ del template
- **Estado (2026-03-24)**: ✅ unificación categ reglas ↔ templates completada; templates creados; arquitectura BD lista; lógica motor pendiente de implementar en código

### Objetivo
Que los 3 grupos tengan **cuenta contable correcta y consistente**, permitiendo un registro certero de todos los ingresos y gastos de la empresa desde sus distintas fuentes.

```
Facturas ARCA  ──────────────────────────────┐
                                              │
Templates (sin factura)  ────────────────────┼──► Registro contable unificado
                                              │    (ingresos + gastos por cuenta)
Gastos bancarios (conciliación automática) ──┘
```

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

### Arquitectura 4 columnas en extractos (completada 2026-03-24)

Las tablas de extracto tienen cuatro columnas de referencia con propósitos distintos:

| Columna | Nivel | Contenido | Aplica a |
|---------|-------|-----------|----------|
| `nro_cuenta` | cuenta | código numérico de `cuentas_contables` | Grupo 1 (ARCA) |
| `template_id` | cuenta | UUID estable del template | Grupo 2 y 3 (templates) |
| `comprobante_arca_id` | pago | UUID de la factura ARCA vinculada | Grupo 1 (ARCA) |
| `template_cuota_id` | pago | UUID de la cuota de template vinculada | Grupo 2 y 3 (templates) |

**Motivación**: desacoplar la "cuenta" (identificador estable que no cambia si se edita el nombre) del "pago" (el registro específico del movimiento). El `nro_cuenta` y `template_id` son el equivalente de un código de cuenta contable para sus respectivos mundos — permiten agrupar y reportar sin depender de string matching.

**Deduplicación motor**: antes de crear una cuota, el motor verifica si `template_cuota_id` ya está asignado en el extracto — si sí, omite la creación.

**Estado en tablas**:
- ✅ `msa.comprobantes_arca` — tiene `nro_cuenta` (implementado previamente)
- ✅ `msa_galicia` / `pam_galicia` / `pam_galicia_cc` — tiene las 4 columnas (nro_cuenta: 2026-03-23, template_id + template_cuota_id: 2026-03-24)
- ⚠️ `egresos_sin_factura` / `cuotas_egresos_sin_factura` — `nro_cuenta` pendiente

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

5. ~~**Reglas de conciliación desincronizadas**~~ ✅ **Resuelto (2026-03-24)**: todas las categ en `reglas_conciliacion` ahora coinciden exactamente con la categ del template correspondiente. `BANC` e `IMP 2` eliminados. ASES desactivada.

---

## 15. HOJA DE RUTA — INTEGRACIÓN COMPLETA CONCILIACIÓN + CONTABILIDAD

### Clasificación de las reglas de conciliación actuales

**Tipo #1 — Gastos bancarios sin template** (`BANC`, `IMP 2`, etc.)
Hoy la regla solo asigna una categ, pero no hay template detrás. La propuesta es crear templates para estos (probablemente abiertos, con monto 0, que se llenan al conciliar). Así pasan del Grupo 3 al Grupo 2 y el registro queda completo.

**Tipo #2 — Facturas ARCA por débito automático** (Smart Farming)
La regla es redundante porque el motor automático debería hacer el match por monto+fecha. Propuesta: eliminar esas reglas una vez verificado que el match funciona.

**Tipo #3 — Templates por débito automático con monto variable** (Metrogas, AYSA)
La regla reconoce el nombre pero no actualiza el template. La propuesta es que al conciliar, si la regla matchea con un template, actualice el monto de la cuota correspondiente con el real del extracto. Esto cierra la diferencia entre lo presupuestado y lo real.

**Tipo #4 — Movimientos específicos con template existente** (FCI, interbancarias, CAJA)
Similar al #3 pero son movimientos no-egreso. La regla los identifica, debería llenar o modificar el template.

**Visión ideal**: todos los movimientos del extracto tienen correlato en una factura ARCA o un template → el extracto queda 100% cubierto sin residuos sin clasificar.

---

### Desafíos y riesgos por tipo

**#1 → nuevos templates**
- ¿Qué tipo de template? Son gastos variables mes a mes → templates abiertos con monto 0 tiene sentido
- Riesgo bajo, es solo crear los templates faltantes

**#2 → eliminar reglas**
- Antes de eliminar hay que confirmar que el motor hace el match en esos casos
- Riesgo: si el match falla (por diferencia de centavos, fecha desplazada) quedarían sin conciliar
- Recomendado: primero verificar en la práctica, después eliminar

**#3 → actualizar template al conciliar**
- ¿Qué cuota actualizar? Hay que definir la lógica: ¿la próxima pendiente en fecha? ¿la más cercana al débito?
- Riesgo de falso positivo: si la regla matchea mal, puede pisar el monto de un template equivocado → necesita confirmación del usuario antes de ejecutar
- Si el template tiene múltiples cuotas futuras y el usuario activó "propagar a cuotas siguientes", la actualización puede tener efecto en cascada

**#4 → FCI / interbancarias**
- FCI es bidireccional: la regla tiene que distinguir suscripción (débito) de rescate (crédito) → ya tenemos la arquitectura `tipo_movimiento` diseñada pero no implementada
- Interbancarias: no son gasto ni ingreso real, son movimiento entre cuentas propias → ¿deben generar registro contable? Requiere definición

**Desafío transversal — consistencia de códigos**
Para que todo esto funcione, las categ de las reglas deben ser **idénticas** a las categ de los templates correspondientes. Hoy no lo son (`TJETA MSA` vs `Tarjetas MSA`, `BANC` sin template, etc.). Antes de implementar la lógica de "regla llena template", hay que resolver esa unificación.

---

### Pasos a seguir (en orden)

**Paso 1 — Unificar categ de reglas con categ de templates** ✅ *Completado 2026-03-24*
- 14 templates nuevos creados: 7 `Gastos Bancarios` + 7 `Impuestos Bancarios`
- Templates CAJA, Tarjetas MSA/PAM convertidos a `abierto` + `es_bidireccional`
- Tarjeta VISA PAM consolidada (USS desactivada)
- 40 reglas actualizadas: categ = nombre exacto del template
- Campo `llena_template BOOLEAN` agregado a `reglas_conciliacion` (true en todas excepto ASES)
- Campo `llena_template` en reglas: `true` = al ejecutar la regla, crear cuota en el template

**Paso 2 — Crear templates Tipo #1 faltantes** ✅ *Completado 2026-03-24*
- Ver detalle en Paso 1 — los 14 templates son los que cubrían este paso
- Pendiente aún: `CRED P` (Intereses Descubierto) — no tiene template todavía

**Paso 3 — Implementar lógica "regla crea cuota en template"** ✅ *Completado 2026-03-24*
- Aplica a todos los tipos cuando `llena_template = true`
- Implementado en `hooks/useMotorConciliacion.ts` función `crearCuotaEnTemplate()`:
  1. Busca template activo cuya `categ` coincide con la de la regla
  2. Si hay múltiples (ej: FCI MSA + PAM), elige el que tiene `responsable` con nombre de empresa de la cuenta (`cuenta.empresa`)
  3. Determina `tipo_movimiento`: 'egreso' si `debitos > 0`, 'ingreso' si `creditos > 0`
  4. Inserta en `cuotas_egresos_sin_factura` con `estado='conciliado'`, `fecha_vencimiento=movimiento.fecha`, `monto=debitos||creditos`, `descripcion=regla.detalle||movimiento.descripcion`
  5. Escribe `template_id` + `template_cuota_id` en el extracto (llamada a `actualizarMovimientoBD` adicional)
- Fix TypeScript aplicado: `centro_costo_asignado: regla.centro_costo ?? undefined` (era `string|null`, necesitaba `string|undefined`)
- Fix configurador: campo `llena_template` faltaba en initialState/resetFormulario/abrirModalEditar de `configurador-reglas.tsx`

**Paso 3b — Modal "Asignar Manualmente" para movimientos sin conciliar** ✅ *Completado 2026-03-24*

Para movimientos que el motor no pudo conciliar automáticamente (descripción bancaria cambió, nueva operación, etc.), se agregó una asignación manual por fila.

**Trigger**: Botón "Asignar" visible en cada fila con `estado != 'conciliado'` en la vista Extracto Bancario.

**Flujo — Camino A (Template)**:
1. Usuario abre modal → tab "Template" activa por default
2. Busca template por nombre (campo búsqueda libre)
3. Lista muestra: `cuenta_agrupadora` (agrupador) + `nombre_referencia` + `categ` + `responsable`
4. Selecciona template → sistema crea cuota nueva en `cuotas_egresos_sin_factura` con `estado='conciliado'`
5. Sistema escribe en extracto: `template_id`, `template_cuota_id`, `categ`, `detalle`, `estado='conciliado'`

**Flujo — Camino B (Factura ARCA)**:
1. Tab "Factura ARCA"
2. Busca factura por proveedor/CUIT/descripción
3. Lista muestra: fecha, proveedor, CUIT, monto, estado
4. Selecciona factura → sistema escribe en extracto: `comprobante_arca_id`, `categ` de la factura (si tiene), `estado='conciliado'`

**Nota sobre Camino C (solo categ)**: Se decidió NO implementar. Todo movimiento debe quedar vinculado a un template o una factura ARCA para trazabilidad completa.

**Campos llenados automáticamente** — usuario nunca ingresa IDs:

| Campo extracto | Camino A (Template) | Camino B (ARCA) |
|----------------|---------------------|-----------------|
| `template_id` | ✅ ID del template | — |
| `template_cuota_id` | ✅ ID de la cuota nueva | — |
| `comprobante_arca_id` | — | ✅ ID de la factura |
| `categ` | ✅ categ del template | ✅ categ de la factura |
| `detalle` | ✅ nombre del template | — |
| `estado` | `'conciliado'` | `'conciliado'` |

**Archivos modificados**:
- `components/vista-extracto-bancario.tsx`: 8 nuevos estados, función `abrirModalAsignar()`, función `ejecutarAsignacion()`, botón por fila, Dialog completo con Tabs
- `types/conciliacion.ts`: campos `nro_cuenta`, `template_id`, `template_cuota_id`, `comprobante_arca_id` agregados a `MovimientoBancario`

**Paso 3c — Mejora selectores: mostrar cuenta_agrupadora y nombre_totalizadora** ✅ *Completado 2026-03-24*

Problema previo: ante múltiples templates/cuentas con nombres similares, el usuario no sabía cuál elegir.

**Templates** (afecta: Modal Pago Manual en Cash Flow y Templates, Modal Asignar en Extracto):
- Se agrega `cuenta_agrupadora` al select de templates
- Lista ordena por `cuenta_agrupadora` primero, luego `nombre_referencia`
- UI muestra agrupador encima del nombre en gris pequeño

**Cuentas contables** (afecta: Vista Asignación ARCA):
- Se agrega `nombre_totalizadora` al select de cuentas
- UI muestra totalizadora encima del categ en gris pequeño
- Confirmado que `nombre_totalizadora` ya está poblado en BD (ej: "VENTA DE HACIENDA", "CREDITOS FISCALES")

**Archivos modificados**:
- `components/vista-cash-flow.tsx`: type + query + UI con cuenta_agrupadora
- `components/vista-templates-egresos.tsx`: ídem
- `components/vista-asignacion-arca.tsx`: type + query + UI con nombre_totalizadora

**Paso 3d — Templates Créditos Bancarios** ✅ *Completado 2026-03-24*

Creados 2 nuevos templates abiertos en BD:

| ID | Nombre | categ | cuenta_agrupadora | responsable | tipo_template |
|----|--------|-------|-------------------|-------------|---------------|
| (auto) | Créditos Tomados | CRED T | Créditos Bancarios | MSA | abierto |
| (auto) | Créditos Pagados | CRED P | Créditos Bancarios | MSA | abierto |

La regla orden=17 (categ=CRED P, `llena_template=true`) ahora tiene template destino válido.

**Paso 4 — Verificar y eliminar reglas Tipo #2 redundantes** ← *pendiente testing*
- Verificar en la práctica que el motor automático hace el match
- Una vez confirmado, eliminar las reglas redundantes

---

## Pendientes identificados al 2026-03-24

### 🔴 Pendiente testing — funcionalidades implementadas

Todo lo de Paso 3 fue implementado pero **no pudo ser probado en esta sesión**. Requiere:

1. **Motor automático** (`ejecutarConciliacion`):
   - Ejecutar sobre extracto MSA Galicia con movimientos en estado 'Pendiente'
   - Verificar que reglas matchean correctamente
   - Verificar que `llena_template=true` crea cuota en template correspondiente
   - Verificar que `template_id` + `template_cuota_id` quedan escritos en extracto

2. **Modal Asignar Manualmente**:
   - Abrir sobre movimiento no conciliado
   - Probar Camino A: buscar template, seleccionar, confirmar → verificar cuota creada + campos extracto escritos
   - Probar Camino B: buscar factura ARCA, seleccionar, confirmar → verificar `comprobante_arca_id` escrito

3. **Selectores con agrupador**:
   - En Pago Manual (Cash Flow y Templates): verificar que muestra `cuenta_agrupadora`
   - En Asignación ARCA: verificar que muestra `nombre_totalizadora`

### 🟡 Pendiente diseño — templates bancarios por empresa

Los 14 templates de Gastos Bancarios + 7 de Impuestos Bancarios + 2 de Créditos tienen actualmente `responsable='MSA'`. Necesitan versiones para PAM y MA:

- Las leyendas bancarias difieren entre cuentas → las reglas PAM/MA serán distintas
- Cuando el motor concilia cuenta PAM, debe usar template con `responsable='PAM'`
- La función `crearCuotaEnTemplate()` ya tiene lógica para elegir por empresa, pero solo funciona si existen los 3 sets de templates

**Acción futura**: Crear ~21 templates adicionales (PAM + MA × cada template bancario)

### 🟡 Pendiente análisis — campo `categ` en extracto vs `template_id`

Hoy el extracto tiene dos campos que potencialmente son redundantes:
- `categ`: código de categoría (texto), llenado por reglas + asignación manual
- `template_id`: UUID del template (UUID), llenado por motor + asignación manual

Con la nueva arquitectura, `template_id` ya contiene toda la información de categorización. Se debe analizar:
- ¿Sigue siendo necesario `categ` en el extracto?
- ¿Hay vistas/queries que dependen de `categ` directamente?
- Posible simplificación: eliminar `categ` del extracto y derivar siempre del template

### ✅ Resuelto 2026-03-25 — responsable 'MSA / PAM' en templates bancarios

Los 14 templates de Gastos Bancarios + Impuestos Bancarios tenían `responsable = 'MSA / PAM'` (ambiguo). Cambiado a `responsable = 'MSA'` vía SQL directo. Cuando se creen cuentas PAM y MA, se crearán sets separados de templates con `responsable = 'PAM'` y `responsable = 'MA'`.

### ✅ Resuelto 2026-03-25 — reglas filtradas por cuenta bancaria

**Columna `cuenta_bancaria_id`** agregada a `reglas_conciliacion`.
- Valores: `'msa_galicia'` | `'pam_galicia'` | `'pam_galicia_cc'` (matching `CuentaBancaria.id`)
- DEFAULT `'msa_galicia'` — 40 reglas existentes actualizadas automáticamente
- El motor pasa `cuenta.id` a `cargarReglasActivas(cuentaId)` que filtra por la columna
- El configurador muestra selector de cuenta bancaria y filtra la lista por cuenta activa
- Crear/editar regla pre-llena `cuenta_bancaria_id` con la cuenta seleccionada

**Archivos modificados**:
- `types/conciliacion.ts`: campo `cuenta_bancaria_id: string` en `ReglaConciliacion`
- `hooks/useReglasConciliacion.ts`: `cargarReglasActivas(cuentaId)` + insert incluye campo
- `hooks/useMotorConciliacion.ts`: `cargarReglasActivas(cuenta.id)`
- `components/configurador-reglas.tsx`: selector + filtro lista + campo en modal

**Para PAM y MA**: cuando se configuren esas cuentas, crear sets de reglas con `cuenta_bancaria_id = 'pam_galicia'` / `'pam_galicia_cc'` con textos de búsqueda propios de cada banco.

### 🟡 Pendiente — templates para PAM y MA

Cuando se configuren cuentas PAM y MA:
- Crear set de 14 templates bancarios con `responsable = 'PAM'` (mismos nombres, mismos categ)
- Crear set de 14 templates bancarios con `responsable = 'MA'`
- Crear sets de reglas con textos de búsqueda propios de cada banco
- El motor elegirá el template correcto por `responsable` matching `cuenta.empresa`

### 🟡 Pendiente — template Pasajes sin cuenta_agrupadora

Template `nombre_referencia = 'Pasajes'`, `categ = 'Viaticos'` no tiene `cuenta_agrupadora`.
Nota del usuario: se puede cambiar en cualquier momento ya que cuenta_agrupadora es solo para display/reportes, no se registra en ningún movimiento.

### 🟡 Pendiente — consistencia completa de templates

Revisar todos los templates existentes para verificar:
- `responsable` correcto (MSA/PAM/MA por separado — `'MSA / PAM'` ya eliminado ✅)
- `cuenta_agrupadora` asignada en todos
- `categ` consistente con código de regla
- `es_bidireccional`: hoy los 14 bancarios tienen `true` (correcto: bancos a veces reintegran gastos mal cobrados)
