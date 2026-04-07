# CONCILIACIÓN + CONTABILIDAD — Documentación Técnica Completa

> **Fecha creación**: 2026-03-22 | **Renombrado**: 2026-03-23 | **Última actualización**: 2026-03-26
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
| `pam_galicia_cc` | Extracto bancario PAM CC (Galicia) | public |
| `msa.caja_general` | Extracto Caja General MSA | msa |
| `msa.caja_ams` | Extracto Caja AMS MSA | msa |
| `msa.caja_sigot` | Extracto Caja Sigot MSA | msa |
| `msa.comprobantes_arca` | Facturas ARCA | msa |
| `cuotas_egresos_sin_factura` | Líneas de templates | public |
| `egresos_sin_factura` | Templates (maestro) | public |
| `reglas_conciliacion` | Reglas automáticas de matching | public |
| `sueldos.pagos` | Pagos/anticipos de sueldos | sueldos |
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

## 10. CUENTAS BANCARIAS Y CAJAS CONFIGURADAS

### Cuentas bancarias

| Nombre | Empresa | Tabla BD | Schema |
|--------|---------|---------|--------|
| MSA Galicia CC Pesos | MSA | `msa_galicia` | public |
| PAM Galicia CA Pesos | PAM | `pam_galicia` | public |
| PAM Galicia CC Pesos | PAM | `pam_galicia_cc` | public |

### Cajas (2026-03-26)

| Nombre | Empresa | Tabla BD | Schema |
|--------|---------|---------|--------|
| Caja General MSA | MSA | `caja_general` | msa |
| Caja AMS MSA | MSA | `caja_ams` | msa |
| Caja Sigot MSA | MSA | `caja_sigot` | msa |

Las cajas tienen la misma estructura de columnas que las tablas bancarias (excepto campos propios del extracto bancario como `origen`, `grupo_de_conceptos`, `numero_de_terminal`, etc.). Ver sección 17 para detalle completo del sistema caja.

Todas las cuentas + cajas están configuradas en `CUENTAS_BANCARIAS` dentro de `hooks/useMotorConciliacion.ts`. El campo `tipo: 'banco' | 'caja'` y `schema_bd?: string` distinguen el comportamiento de cada una.

### Selector de cuenta en la vista

El header de Extracto Bancario muestra un botón siempre visible con la cuenta/caja activa.

Al clickearlo abre el Dialog selector con **dos grupos**: "Cuentas Bancarias" y "Cajas". La cuenta/caja seleccionada se pasa al hook `useMovimientosBancarios(tabla, schema)`, que recarga automáticamente al cambiar. El schema se detecta automáticamente desde `CuentaBancaria.schema_bd`.

---

## 11. ARQUITECTURA MULTI-SCHEMA (MSA / PAM)

### Schemas en Supabase

| Schema | Contenido | Acceso desde código |
|--------|-----------|---------------------|
| `public` | Extractos bancarios + todas las tablas compartidas | `supabase.from('tabla')` |
| `msa` | Facturas ARCA + tablas de caja empresa MSA | `supabase.schema('msa').from('tabla')` |
| `pam` | Facturas ARCA empresa PAM | `supabase.schema('pam').from('tabla')` |
| `sueldos` | Empleados, períodos, pagos | `supabase.schema('sueldos').from('tabla')` |

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

### ✅ Resuelto 2026-03-27 — Seleccionar cuenta no dispara conciliación + MSA como default

**Bug**: Al seleccionar una cuenta en el modal selector, `ejecutarConCuenta()` llamaba automáticamente a `ejecutarConciliacion()`. Correcto es que seleccionar cuenta solo cargue los movimientos — la conciliación corre solo al presionar el botón explícito.

**Bug adicional**: `cuentaSeleccionada` inicializaba en `""` → header mostraba "Seleccionar cuenta" aunque ya mostraba datos de MSA.

**Fix aplicado** (`components/vista-extracto-bancario.tsx`):
- `useState<string>("")` → `useState<string>("msa_galicia")`
- `ejecutarConCuenta()`: eliminado `await ejecutarConciliacion(cuenta)`, reemplazado por solo `recargar()`

**Commit**: `cd555ad`

---

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

---

## 16. GUÍA DE TESTING — LO QUE SE IMPLEMENTÓ Y CÓMO VERIFICARLO

> **Contexto**: Todo lo de los Pasos 1-3d fue implementado en sesiones 2026-03-24/25 pero **no fue testeado en producción**. Esta sección existe para que al retomar, se pueda verificar cada funcionalidad de forma sistemática sabiendo exactamente qué debe pasar y cómo confirmarlo en BD.

---

### TEST 1 — Motor automático: regla matchea y crea cuota en template

**Ubicación UI**: Vista Extracto Bancario → botón "Ejecutar Conciliación" (seleccionar cuenta MSA Galicia)

**Pre-condición**: que existan movimientos en estado `'Pendiente'` en la tabla `msa_galicia`. Verificar con:
```sql
SELECT id, fecha, descripcion, debitos, creditos, estado
FROM msa_galicia
WHERE estado = 'Pendiente'
ORDER BY fecha
LIMIT 10;
```

**Qué hace el motor (código: `hooks/useMotorConciliacion.ts` → `ejecutarConciliacion()`)**:
1. Carga movimientos con `estado = 'Pendiente'` de `msa_galicia`
2. Carga reglas activas con `cuenta_bancaria_id = 'msa_galicia'` (filtro clave nuevo)
3. Para cada movimiento: intenta match por Cash Flow primero, luego por reglas en orden
4. Si una regla matchea y tiene `llena_template = true`: llama `crearCuotaEnTemplate()`
5. `crearCuotaEnTemplate()`:
   - Busca en `egresos_sin_factura` donde `categ = regla.categ` y `activo = true`
   - Si hay varios, elige el que tiene `responsable` que incluye `'MSA'` (empresa de la cuenta)
   - Inserta en `cuotas_egresos_sin_factura` con `estado='conciliado'`, `tipo_movimiento='egreso'/'ingreso'`, `monto=debitos||creditos`, `fecha_vencimiento=movimiento.fecha`
   - Retorna `{ templateId, cuotaId }`
6. El extracto queda actualizado con: `categ`, `detalle`, `estado='conciliado'`, `template_id`, `template_cuota_id`

**Cómo verificar resultado en BD** (ejecutar después del motor):
```sql
-- Ver movimientos que se conciliaron por regla y tienen template vinculado
SELECT
  m.id,
  m.fecha,
  m.descripcion,
  m.debitos,
  m.creditos,
  m.estado,
  m.categ,
  m.template_id,
  m.template_cuota_id,
  e.nombre_referencia AS template_nombre
FROM msa_galicia m
LEFT JOIN egresos_sin_factura e ON e.id::text = m.template_id
WHERE m.estado = 'conciliado'
  AND m.template_id IS NOT NULL
ORDER BY m.fecha DESC
LIMIT 20;
```

```sql
-- Ver cuotas creadas automáticamente por el motor (las recientes)
SELECT
  c.id,
  c.egreso_id,
  c.fecha_vencimiento,
  c.monto,
  c.estado,
  c.tipo_movimiento,
  c.descripcion,
  c.created_at,
  e.nombre_referencia AS template_nombre,
  e.categ
FROM cuotas_egresos_sin_factura c
JOIN egresos_sin_factura e ON e.id = c.egreso_id
WHERE c.estado = 'conciliado'
ORDER BY c.created_at DESC
LIMIT 20;
```

**Resultado esperado**:
- Movimientos con regla que matcheó: `estado='conciliado'`, `categ` = categ de la regla, `template_id` y `template_cuota_id` no nulos
- En `cuotas_egresos_sin_factura`: nueva fila con `egreso_id` del template correspondiente, `monto` = monto del movimiento, `estado='conciliado'`, `tipo_movimiento='egreso'` (si era débito) o `'ingreso'` (si era crédito)
- El `template_cuota_id` del extracto debe coincidir con el `id` de la cuota recién creada

**Posibles errores y qué buscar**:
- "No hay template activo con categ X": la categ de la regla no coincide con ningún template en BD. Verificar con: `SELECT categ, nombre_referencia FROM egresos_sin_factura WHERE activo=true ORDER BY categ`
- Motor no aplica reglas: verificar que las reglas tienen `cuenta_bancaria_id='msa_galicia'`. Query: `SELECT id, orden, texto_buscar, cuenta_bancaria_id FROM reglas_conciliacion WHERE activo=true ORDER BY orden`
- Cuota creada pero `template_id` no escrito en extracto: buscar error en consola del browser al ejecutar el motor

---

### TEST 2 — Motor: regla matchea sin llena_template (solo categ)

Algunas reglas tienen `llena_template = false` (ej: ASES que está desactivada, o futuras reglas de solo categorización).

**Resultado esperado**: movimiento queda `estado='conciliado'`, `categ` asignada, pero `template_id` y `template_cuota_id` quedan NULL.

---

### TEST 3 — Modal "Asignar Manualmente" — Camino A (Template)

**Ubicación UI**: Vista Extracto Bancario → fila con estado `'Pendiente'` o `'auditar'` → botón "Asignar"

**Flujo esperado**:
1. Se abre Dialog con dos tabs: "Template" (activa) y "Factura ARCA"
2. Campo de búsqueda libre → escribir parte del nombre del template (ej: "comision")
3. Lista muestra templates con `cuenta_agrupadora` en gris encima del `nombre_referencia`
4. Seleccionar un template → aparece confirmación
5. Confirmar → el sistema:
   - Crea cuota nueva en `cuotas_egresos_sin_factura`
   - Actualiza extracto: `template_id`, `template_cuota_id`, `categ`, `detalle`, `estado='conciliado'`

**Verificar en BD**:
```sql
-- Ver el movimiento que se asignó manualmente
SELECT
  m.id, m.fecha, m.descripcion, m.debitos, m.creditos,
  m.estado, m.categ, m.detalle,
  m.template_id, m.template_cuota_id, m.comprobante_arca_id
FROM msa_galicia m
WHERE m.id = '[ID_DEL_MOVIMIENTO]';

-- Ver la cuota creada
SELECT * FROM cuotas_egresos_sin_factura
WHERE id = '[template_cuota_id del extracto]';
```

**Resultado esperado**: `estado='conciliado'`, `template_id` = UUID del template seleccionado, `template_cuota_id` = UUID de la cuota recién creada (ambos coinciden entre extracto y cuotas).

**Posibles errores**:
- Lista de templates vacía: verificar que `egresos_sin_factura` tiene registros con `activo=true`
- Cuota creada pero extracto no actualizado: buscar error en consola del browser en función `ejecutarAsignacion()`
- Archivo: `components/vista-extracto-bancario.tsx` → función `ejecutarAsignacion()`

---

### TEST 4 — Modal "Asignar Manualmente" — Camino B (Factura ARCA)

**Flujo esperado**:
1. Tab "Factura ARCA"
2. Buscar por proveedor/CUIT/descripción
3. Seleccionar factura
4. Confirmar → el sistema actualiza el extracto: `comprobante_arca_id`, `categ` (si la factura tiene cuenta_contable), `estado='conciliado'`
5. La factura ARCA NO se modifica en este paso (solo se vincula el extracto hacia la factura)

**Verificar en BD**:
```sql
SELECT
  m.id, m.fecha, m.estado, m.categ,
  m.comprobante_arca_id,
  f.denominacion_emisor, f.imp_total, f.estado AS estado_factura
FROM msa_galicia m
JOIN msa.comprobantes_arca f ON f.id::text = m.comprobante_arca_id
WHERE m.comprobante_arca_id IS NOT NULL
ORDER BY m.fecha DESC LIMIT 5;
```

**Resultado esperado**: `comprobante_arca_id` no nulo, `estado='conciliado'`, `categ` propagada si la factura tenía `cuenta_contable`.

---

### TEST 5 — Selectores con cuenta_agrupadora y nombre_totalizadora

**Ubicación 1**: Vista Cash Flow o Vista Templates → botón "Pago Manual" → selector de template
- **Esperado**: Lista muestra agrupador en gris pequeño encima del nombre del template
- **Ejemplo**: "Gastos Bancarios" (gris) / "Comision Cuenta Bancaria" (negro)

**Ubicación 2**: Vista Extracto → Modal Asignar → tab Template → lista de templates
- **Mismo comportamiento** que el anterior

**Ubicación 3**: Vista Asignación ARCA → selector de cuenta contable
- **Esperado**: Lista muestra `nombre_totalizadora` en gris encima del `categ`
- **Ejemplo**: "GASTOS DE COMERCIALIZACION" (gris) / "COMISIONES VENTAS" (negro)
- Archivos: `components/vista-asignacion-arca.tsx`

---

### TEST 6 — Configurador de reglas: filtro por cuenta bancaria

**Ubicación UI**: Vista Extracto Bancario → tab "Configuración" → "Reglas de Conciliación"

**Esperado**:
- Selector en el header que muestra las 3 cuentas bancarias (MSA Galicia CC, PAM Galicia CA, PAM Galicia CC)
- Al seleccionar MSA Galicia: muestra las 40 reglas existentes
- Al seleccionar PAM: muestra 0 reglas (aún no creadas)
- Crear nueva regla: el campo `cuenta_bancaria_id` se pre-llena con la cuenta seleccionada en el filtro

**Verificar en BD**:
```sql
SELECT cuenta_bancaria_id, COUNT(*) as total
FROM reglas_conciliacion
GROUP BY cuenta_bancaria_id;
-- Esperado: msa_galicia: 40, pam_galicia: 0, pam_galicia_cc: 0
```

---

### ERRORES CONOCIDOS / POSIBLES DURANTE TESTING

| Síntoma | Causa probable | Dónde buscar |
|---------|---------------|--------------|
| Motor no encuentra reglas | `cuenta_bancaria_id` faltante o distinto | Query en `reglas_conciliacion` para verificar valores |
| `crearCuotaEnTemplate` no crea cuota | categ de regla no coincide con categ de template | `SELECT categ FROM egresos_sin_factura WHERE activo=true` |
| Cuota creada duplicada | Motor ejecutado dos veces sobre mismo movimiento | Verificar lógica deduplicación por `template_cuota_id` en extracto |
| `template_id` escrito pero `template_cuota_id` nulo | Error al crear cuota, falla silenciosa | Ver console.error en browser al ejecutar motor |
| Modal Asignar no abre | Botón no visible para movimientos 'conciliado' | Verificar condición: `estado != 'conciliado'` en renderizado fila |
| Lista templates vacía en modal | `egresos_sin_factura` sin activos o query falla | Verificar `activo=true` en BD + network tab browser |
| Selector no muestra agrupadora | Cambio no deployado o localStorage corrupto | Hard refresh (Ctrl+Shift+R) |

---

### ARCHIVOS CLAVE Y QUÉ HACE CADA UNO

| Archivo | Función relevante | Qué hace |
|---------|------------------|----------|
| `hooks/useMotorConciliacion.ts` | `ejecutarConciliacion()` | Loop principal movimientos → Cash Flow → reglas |
| `hooks/useMotorConciliacion.ts` | `crearCuotaEnTemplate()` | Crea cuota + retorna IDs |
| `hooks/useMotorConciliacion.ts` | `actualizarMovimientoBD()` | Escribe campos en extracto |
| `hooks/useReglasConciliacion.ts` | `cargarReglasActivas(cuentaId)` | Filtra reglas por cuenta_bancaria_id |
| `components/vista-extracto-bancario.tsx` | `ejecutarAsignacion()` | Lógica modal Asignar Manual |
| `components/configurador-reglas.tsx` | estado `cuentaFiltro` | Selector y filtro lista de reglas |
| `types/conciliacion.ts` | `ReglaConciliacion` | Incluye campo `cuenta_bancaria_id` |

---

## 17. SISTEMA CAJA (2026-03-26)

### Arquitectura

Las cajas funcionan **exactamente igual** que los extractos bancarios: misma vista, misma lógica de conciliación, mismo import. La diferencia es que las tablas están en el schema `msa` (no `public`) y los movimientos se originan en el reporte físico de caja (no en un extracto bancario digital).

### Tablas BD

```sql
-- Las 3 tablas tienen la misma estructura
msa.caja_general  -- Caja General MSA
msa.caja_ams      -- Caja AMS MSA (Alejandro Martínez Sobrado)
msa.caja_sigot    -- Caja Sigot MSA (Rubén Sigot)

-- Columnas incluidas (subconjunto de msa_galicia — solo las relevantes para caja):
id, fecha, descripcion, debitos, creditos, saldo, control,
categ, detalle, contable, interno, centro_de_costo, cuenta, orden,
estado, motivo_revision, comprobante_arca_id, nro_cuenta, template_id, template_cuota_id
```

**Columnas de msa_galicia NO incluidas** (son propias del extracto bancario Galicia):
`origen`, `grupo_de_conceptos`, `concepto`, `numero_de_terminal`, `observaciones_cliente`, `numero_de_comprobante`, `leyendas_adicionales_1-4`, `tipo_de_movimiento`

### Campo `medio_pago`

Agregado en **2026-03-26** para rastrear desde dónde sale cada pago:

| Tabla | Campo | Valores posibles | Default |
|-------|-------|-----------------|---------|
| `cuotas_egresos_sin_factura` | `medio_pago` | banco / caja_general / caja_ams / caja_sigot | banco |
| `sueldos.pagos` | `medio_pago` | banco / caja_general / caja_ams / caja_sigot | banco |
| `msa.comprobantes_arca` | `medio_pago` | banco / caja_general / caja_ams / caja_sigot | banco |

**Dónde se setea en UI**:
- Templates → modal "Pago Manual": selector antes de fecha
- Sueldos → modal "Anticipo": selector bajo "Estado en Cash Flow"
- ARCA → columna inline editable (oculta por defecto, activable desde configurador columnas)
- Cash Flow → filtro "Medio de Pago" en panel de filtros

### Schema routing en hooks

```typescript
// useMotorConciliacion.ts — CuentaBancaria extendida
interface CuentaBancaria {
  schema_bd?: string  // 'public' (default) | 'msa'
  tipo?: 'banco' | 'caja'
}

// useMovimientosBancarios.ts — acepta schema
function useMovimientosBancarios(tabla: string, schema: string = 'public') {
  // queries → schema === 'msa' ? supabase.schema('msa') : supabase
}

// vista-extracto-bancario.tsx — auto-detecta schema
const schemaActivo = CUENTAS_BANCARIAS.find(c => c.id === cuentaSeleccionada)?.schema_bd || 'public'
```

### Pendientes caja

| Pendiente | Descripción |
|-----------|-------------|
| **Importador caja** | API `/api/import-caja` — leer reporte físico de caja (Excel/CSV) y poblar la tabla correspondiente. Definir formato del reporte primero. |
| **Interceptor template CAJA** | Cuando el motor concilia un movimiento bancario y asigna template CAJA (débito banco → ingreso caja), interceptar y pedir confirmación al usuario antes de ejecutar. Pendiente para Fase 5. |
| **Reglas de conciliación para cajas** | Hoy las 40 reglas son solo para `msa_galicia`. Cuando se carguen datos en las cajas, crear reglas con `cuenta_bancaria_id = 'caja_general'` etc. |
| **Cajas PAM** | Si PAM necesita cajas en el futuro, crear tablas equivalentes en schema `pam`. |
| `types/conciliacion.ts` | `MovimientoBancario` | Incluye `nro_cuenta`, `template_id`, `template_cuota_id`, `comprobante_arca_id` |

---

## 18. DIAGNÓSTICO Y FIXES — PRIMERA PRUEBA REAL (2026-03-27)

### 18.1 — Arquitectura de IDs: dos sistemas paralelos

El extracto bancario tiene 4 campos de referencia que corresponden a **dos sistemas independientes**:

| Sistema | Identifica al | Vincula el pago a su | Solo aplica cuando |
|---------|--------------|----------------------|--------------------|
| **Facturas ARCA** | `nro_cuenta` (código plan de cuentas) | `comprobante_arca_id` (UUID factura) | El movimiento bancario paga una factura ARCA |
| **Templates** | `template_id` (UUID del template) | `template_cuota_id` (UUID de la cuota) | El movimiento bancario corresponde a un template (boleta, impuesto, etc.) |

El campo `categ` es el **nombre** que funciona para ambos sistemas.

**`nro_cuenta` es para ARCA únicamente** — para templates no aplica (el `template_id` cumple esa función).

### 18.2 — Bug detectado: Fase 1 no escribía IDs

**Síntoma**: Al conciliar 15 movimientos reales de MSA Galicia (Feb 2026):
- 10 movimientos (Grupo A) conciliados por Fase 2 (reglas + `llena_template=true`) → `template_id` + `template_cuota_id` correctos ✅
- 4 movimientos (Grupo B) conciliados por Fase 1 (Cash Flow match) → `conciliado` pero sin `template_id` ni `template_cuota_id` ❌

**Root cause**: En `useMotorConciliacion.ts`, el bloque de Fase 1 llamaba a `actualizarMovimientoBD` sin incluir los campos de ID.

**Fix aplicado** (commit `3869724`):
```typescript
// Antes de escribir en BD, detectar origen del CF row y agregar IDs correspondientes
const extraIdsCF: any = {}
if (matchCF.cashFlowRow.origen === 'TEMPLATE') {
  if (matchCF.cashFlowRow.egreso_id) extraIdsCF.template_id = matchCF.cashFlowRow.egreso_id
  extraIdsCF.template_cuota_id = matchCF.cashFlowRow.id
} else if (matchCF.cashFlowRow.origen === 'ARCA') {
  extraIdsCF.comprobante_arca_id = matchCF.cashFlowRow.id
}
// ANTICIPO y SUELDO no tienen IDs que mapear en el extracto
```

Los datos estaban disponibles en `cashFlowRow` (`id` = cuota/factura, `egreso_id` = template padre, `origen` = tipo).

### 18.3 — Fix manual: IDs de los 2 movimientos del Grupo B con template

Los 2 movimientos del Grupo B que eran de origen TEMPLATE fueron corregidos manualmente en BD:

| orden | Descripción | Template | Template ID | Cuota ID |
|-------|-------------|----------|-------------|----------|
| 12 | Rescate Fima | FIMA Premium Galicia Pesos | `886bba83…` | `cd39844f…` |
| 13 | Trf Inmed Proveed | Retiro MA mensual | `dc5e3309…` | `906ff947…` |

Los otros 2 del Grupo B (órdenes 14 y 15, origen ANTICIPO) no tienen `template_id` — es correcto, los anticipos tienen su propia tabla de seguimiento.

### 18.4 — Fix: selector cuenta no dispara conciliación + MSA como default

**Síntoma**: Al abrir Extracto Bancario el header decía "Seleccionar cuenta" aunque los datos de MSA ya se mostraban. Al seleccionar MSA explícitamente, el motor corría automáticamente.

**Root cause**:
- `cuentaSeleccionada` inicializado como `""` mientras `tablaActiva` defaultea a `'msa_galicia'`
- `ejecutarConCuenta()` llamaba `await ejecutarConciliacion(cuenta)` al seleccionar

**Fix aplicado** (commit `cd555ad`):
- `useState<string>("")` → `useState<string>("msa_galicia")`
- `ejecutarConCuenta()`: eliminado el `await ejecutarConciliacion()`, queda solo `recargar()`

### 18.5 — Feature: selector de columnas en tabla de movimientos

**Qué hace**: Botón "Columnas" en el header de la tabla → Popover con checkboxes para activar/desactivar columnas. Persiste en `localStorage`.

**Columnas fijas** (siempre visibles): Fecha, Descripción, Débitos, Créditos, Estado, Acciones.

**Columnas opcionales**:

| Columna | Default | Uso |
|---------|---------|-----|
| Saldo | ON | Verificación saldo acumulado |
| CATEG | ON | Categoría asignada por motor |
| Detalle | ON | Detalle de la regla aplicada |
| Motivo Revisión | ON | Motivo cuando estado = auditar |
| Centro de Costo | OFF | Centro de costo asignado |
| Contable | OFF | Campo contable (pendiente motor contable) |
| Interno | OFF | Campo interno (pendiente motor contable) |
| Nro Cuenta | OFF | Solo aplica en sistema ARCA |
| Template ID | OFF | UUID del template (verde ✓ si tiene) |
| Cuota ID | OFF | UUID de la cuota del template (verde ✓ si tiene) |
| Factura ARCA ID | OFF | UUID de la factura ARCA (azul ✓ si tiene) |
| Origen | OFF | Texto libre del extracto bancario |
| Control | OFF | Diferencia saldo real vs calculado |
| Orden | OFF | Número de orden del movimiento |

Los IDs (UUIDs) se muestran abreviados (primeros 8 chars + "…") con tooltip para ver el UUID completo.

**Commit**: `1d1aea1`

### 18.6 — Fix: Fase 1 actualiza estado cuota/factura a 'conciliado'

**Síntoma**: Al conciliar un movimiento via Fase 1 (Cash Flow match), el extracto quedaba en estado `'conciliado'` pero la cuota del template (o factura ARCA) seguía en estado `'pagado'`/`'pagar'`. No se actualizaba el lado del template/factura.

**Fix aplicado** (commit `955051e`):
```typescript
if (estadoFinal === 'conciliado') {
  if (matchCF.cashFlowRow.origen === 'TEMPLATE') {
    await supabase.from('cuotas_egresos_sin_factura')
      .update({ estado: 'conciliado' })
      .eq('id', matchCF.cashFlowRow.id)
  } else if (matchCF.cashFlowRow.origen === 'ARCA') {
    await supabase.from('comprobantes_arca')
      .update({ estado: 'conciliado' })
      .eq('id', matchCF.cashFlowRow.id)
      .schema('msa')
  }
}
```

Solo se actualiza cuando `estadoFinal === 'conciliado'` (no cuando queda en `'auditar'`).

### 18.7 — Feature: alerta anticipos sin factura en extracto activo

**Qué hace**: Badge en el header de Extracto Bancario que muestra cuántos movimientos del extracto activo tienen categ que contiene `'anticipo'` (case-insensitive) y `comprobante_arca_id IS NULL`. Indica anticipos pagados que aún no fueron vinculados a su factura ARCA.

**Scope**: Solo el extracto activo (tabla seleccionada en el selector de cuentas), no es global del sistema.

**Implementación**: `useState` + `useEffect` con query:
```sql
SELECT COUNT(*) FROM [tablaActiva]
WHERE categ ILIKE '%anticipo%'
AND comprobante_arca_id IS NULL
```

**Issue durante implementación**: El `useEffect` fue colocado inicialmente antes de que `tablaActiva` y `movimientos` estuvieran declarados en el cuerpo del componente, causando un crash por TDZ (Temporal Dead Zone) de React. Fix: mover el `useState` + `useEffect` a después del hook `useMovimientosBancarios`.

**Commit**: `b5fffba`

### 18.8 — Fix manual: orden 15 (González Omar → factura ARCA)

El movimiento de orden 15 (débito $1.900.000, González Omar) fue conciliado manualmente en BD asignando los datos de su factura ARCA:

```sql
UPDATE msa.msa_galicia SET
  comprobante_arca_id = '00e27255-...',
  categ = 'AGUADAS',
  nro_cuenta = '42325',
  estado = 'conciliado'
WHERE orden = 15;

UPDATE msa.comprobantes_arca SET estado = 'conciliado'
WHERE id = '00e27255-...';
```

La factura fue encontrada buscando por CUIT del proveedor y monto coincidente ($1.900.000).

### 18.9 — Pendiente Fix B: nro_cuenta para movimientos ARCA

Cuando un movimiento se concilia contra una factura ARCA (via `comprobante_arca_id`), escribir también `nro_cuenta` requiere un lookup adicional: `categ de la factura → cuentas_contables → nro_cuenta`. No implementado aún. Solo relevante cuando empiecen a conciliarse movimientos vinculados a facturas ARCA.

**Commit**: pendiente

---

## 20. FIX IMPORTADOR — DEDUPLICACIÓN MISMO DÍA (2026-03-27)

**Problema**: El importador descartaba todas las filas con fecha igual o anterior a la última fecha existente en BD (`<=`). Si se importaba un lote parcial de un día y quedaban movimientos de ese mismo día sin importar, no había forma de agregarlos después.

**Fix aplicado** (commit `92adcb3`):

- Fechas **anteriores** a la última → se descartan siempre (sin cambio)
- Fechas **del mismo día** que la última → se verifica si el movimiento ya existe por `descripcion + debitos + creditos`. Si existe se saltea, si no existe se inserta
- Fechas **posteriores** → se insertan siempre (sin cambio)

**Cómo funciona**: Al iniciar la importación, si hay una última fecha en BD, se carga un Set con todos los movimientos de ese día ya existentes. Cada fila del Excel del mismo día se verifica contra ese Set antes de insertar.

**Archivo**: `app/api/import-excel/route.ts`

---

## 19. ARQUITECTURA DE NIVELES — CATEG, TEMPLATE_ID Y MODELO DE AGRUPACIÓN (2026-03-27)

> Este diagnóstico surgió al investigar inconsistencias en el campo `categ` del extracto. La conclusión es que la arquitectura tiene imperfecciones conocidas pero todos los datos necesarios para reportes están presentes — en el peor caso se requieren queries con JOINs adicionales.

### 19.1 — El modelo de 4 niveles en templates

Los templates tienen una jerarquía de **4 niveles**. En la BD se ven así:

```
Nivel 0 — cuenta_agrupadora  (texto, sin ID)   →  ej: "Impuestos Rurales"
Nivel 1 — categ              (texto, sin ID)   →  ej: "Impuesto inmobiliario"
Nivel 2 — nombre_referencia  (con ID)          →  ej: "Inmobiliario Cuota Tapera 1"
           egresos_sin_factura.id              →  3dc6b92e-fc3a-4e30-bf34-183e0feae5a0
Nivel 3 — cuota individual   (con ID)          →  ej: cuota marzo 2026
           cuotas_egresos_sin_factura.id       →  3a378b93-0739-444e-935a-0004d164a331
```

Ejemplo concreto con datos reales:

```
cuenta_agrupadora:   "Impuestos Rurales"
categ:               "Impuesto inmobiliario"
nombre_referencia:   "Inmobiliario Cuota Tapera 1"
template_id:         3dc6b92e-fc3a-4e30-bf34-183e0feae5a0
                     ├── Cuota Mar-2026  id: 3a378b93  pagado   $35.672,80
                     ├── Cuota Jun-2026  id: 292207bb  pendiente
                     ├── Cuota Sep-2026  id: ce69821e  pendiente
                     └── Cuota Nov-2026  id: 0389af4a  pendiente
```

**Clave para entenderlo**: `categ` NO tiene ID propio. Un mismo categ (`"Impuesto inmobiliario"`) agrupa 30+ templates distintos, cada uno con su `template_id`. El `template_id` no es el identificador de categ — es el identificador del `nombre_referencia`, que está **un nivel más abajo**.

### 19.2 — Lo que el extracto registra al conciliar un template

Al conciliar un movimiento bancario contra un template, el extracto guarda:

```
extracto.categ             →  nivel 1  ("Impuesto inmobiliario")       — texto
extracto.template_id       →  nivel 2  (UUID de "Inmobiliario Tapera 1") — UUID
extracto.template_cuota_id →  nivel 3  (UUID de cuota marzo 2026)        — UUID
```

`cuenta_agrupadora` (nivel 0) **no se guarda** en el extracto. Se obtiene via JOIN:
```sql
extracto → template_id → egresos_sin_factura.cuenta_agrupadora
```

### 19.3 — Inconsistencia de categ entre ARCA y Templates

El campo `extracto.categ` tiene **semántica distinta** según el origen del movimiento:

| Origen | Qué guarda extracto.categ | Ejemplo |
|--------|--------------------------|---------|
| ARCA | Código de cuenta contable de `cuentas_contables` | `"42325"`, `"AGUADAS"` |
| Template | categ propio del template (nivel 1 del árbol) | `"Impuesto inmobiliario"`, `"CRED P"` |

Estos dos vocabularios **no se cruzan**: los categ de templates no existen en `cuentas_contables` y viceversa. Esto es por diseño — son sistemas de cuentas distintos — pero genera que el campo `categ` del extracto no tenga una semántica uniforme.

### 19.4 — Inconsistencia en ARCA: cuenta_contable almacena categ

En `comprobantes_arca`, el campo se llama `cuenta_contable` pero almacena el valor de `cuentas_contables.categ` (no el nombre de la cuenta). El selector ARCA hace:

```typescript
value={cuenta.categ}  // guarda categ, no nombre
```

Esto funciona porque en `cuentas_contables` los campos `categ` y `cuenta_contable` son siempre el mismo valor. Pero el nombre del campo `cuenta_contable` en facturas ARCA es engañoso — en realidad contiene una categ.

La cadena completa para ARCA:
```
cuentas_contables.categ → comprobantes_arca.cuenta_contable → CashFlowRow.categ → extracto.categ
```

### 19.5 — categ como agrupador: no debe igualarse a nombre_referencia

Una tentación natural es "simplificar" igualando `categ = nombre_referencia` para evitar la distinción. **Esto sería un error**: el categ funciona como agrupador de múltiples templates. Si se iguala, se pierde la capacidad de reportar "todos los Inmobiliarios juntos" o "todos los Sueldos juntos".

Los únicos categ que conviene limpiar son los **abreviados inconsistentes**:

| categ actual | propuesto | cuenta_agrupadora |
|-------------|-----------|-------------------|
| CRED P | Créditos Pagados | Créditos Bancarios |
| CRED T | Créditos Tomados | Créditos Bancarios |
| FCI | Fondos Comunes de Inversión | Inversiones |
| CAJA | Caja | Movimientos Internos empresa |

Este cambio es **solo datos** (sin código): UPDATE en `egresos_sin_factura.categ` + UPDATE en `reglas_conciliacion.categ` correspondientes + opcional UPDATE en filas históricas del extracto.

### 19.6 — Conclusión: reportes posibles con la arquitectura actual

Todos los datos necesarios para reportes están presentes. Algunos requerirán JOINs adicionales:

| Reporte | Query directa | Requiere JOIN |
|---------|--------------|---------------|
| Movimientos por categ | `extracto.categ` | No |
| Movimientos por cuenta_agrupadora | — | Sí: `template_id → egresos_sin_factura.cuenta_agrupadora` |
| Movimientos por responsable | — | Sí: `template_id → egresos_sin_factura.responsable` |
| Movimientos por factura ARCA | `comprobante_arca_id` | No |
| Movimientos por template específico | `template_id` | No |
| Movimientos por cuota específica | `template_cuota_id` | No |

Nada imposible — solo algunas queries más elaboradas donde el dato no está directo en el extracto.

---

## 21. SISTEMA CONTABLE E INTERNO — REGLAS POR TEMPLATE (2026-03-27)

### 21.1 — Propósito

Los campos `contable` e `interno` del extracto bancario son imputaciones contables que indican **cómo se asienta el movimiento** en los libros de la empresa. No todos los pagos generan asiento (ej: PAM paga algo de PAM → no se asienta nada). Solo algunos pagos entre empresas distintas requieren un código de contable/interno.

La lógica correcta es:
- Si la empresa que paga **es la misma** que el responsable del template → no hay asiento → no escribir `contable`/`interno`
- Si la empresa que paga **es distinta** del responsable → hay asiento → escribir `contable`/`interno`
- Algunos templates tienen reglas **siempre activas** (ej: Sueldos, Retiros) que aplican sin importar quién paga

### 21.2 — Columna `seccion_regla` en `egresos_sin_factura`

**Migración aplicada**:

```sql
ALTER TABLE egresos_sin_factura
ADD COLUMN IF NOT EXISTS seccion_regla INTEGER DEFAULT NULL;

-- Auto-asignación inicial: templates con valores reales en contable/interno → sección 1
UPDATE egresos_sin_factura SET seccion_regla = 1
WHERE seccion_regla IS NULL
AND (
  (codigo_contable IS NOT NULL AND TRIM(codigo_contable) != ''
   AND LOWER(REPLACE(REPLACE(codigo_contable,' ',''),chr(160),'')) != 'nolleva')
  OR
  (codigo_interno IS NOT NULL AND TRIM(codigo_interno) != ''
   AND LOWER(REPLACE(REPLACE(codigo_interno,' ',''),chr(160),'')) != 'nolleva')
);
-- Resultado: 23 templates → seccion_regla=1 | 133 templates → NULL
```

**Semántica de los valores**:

| Valor | Nombre | Comportamiento en el motor |
|-------|--------|---------------------------|
| `1` | Regla fija | Siempre escribe `contable`/`interno` — independiente de quién paga |
| `2` | Regla por responsable | Solo escribe si `cuenta.empresa ≠ template.responsable` |
| `NULL` | Sin regla | No escribe nada — se ignora |

Se eligió INTEGER (no boolean) para extensibilidad futura (sección 3, 4, etc.).

### 21.3 — Helpers en el motor

Agregados en `hooks/useMotorConciliacion.ts`:

```typescript
// Filtra valores que no son un código real
const esValorContableValido = (val: string | null | undefined): boolean => {
  if (!val || val.trim() === '') return false
  return !val.toLowerCase().replace(/\s+/g, '').includes('nolleva')
}

// Decide si un template debe escribir sus códigos al extracto
const debeAplicarCodigos = (
  tmpl: { seccion_regla?: number | null; responsable?: string | null },
  cuenta: CuentaBancaria
): boolean => {
  if (!tmpl.seccion_regla) return false
  if (tmpl.seccion_regla === 1) return true
  if (tmpl.seccion_regla === 2) {
    const empresa = cuenta.empresa.toLowerCase()
    const resp = (tmpl.responsable || '').toLowerCase()
    return empresa !== resp
  }
  return false
}
```

**`esValorContableValido`**: rechaza `null`, vacío, y cualquier variante de "No Lleva" (con/sin espacios, mayúsculas). "No Lleva" no es un código contable real — es un valor placeholder que indica "no aplica".

**`debeAplicarCodigos`**: la lógica de sección:
- `seccion_regla = null` → skip
- `seccion_regla = 1` → siempre aplica
- `seccion_regla = 2` → solo si empresa pagadora ≠ responsable del template

### 21.4 — Fase 1 (Cash Flow match → TEMPLATE): escritura de contable/interno

Cuando el motor concilia un movimiento por Fase 1 y el origen es `'TEMPLATE'`, ahora consulta los campos del template y los escribe condicionalmente:

```typescript
const { data: tmplData } = await supabase
  .from('egresos_sin_factura')
  .select('codigo_contable, codigo_interno, seccion_regla, responsable')
  .eq('id', matchCF.cashFlowRow.egreso_id)
  .maybeSingle()

if (tmplData && debeAplicarCodigos(tmplData as any, cuenta)) {
  const td = tmplData as any
  if (esValorContableValido(td.codigo_contable)) extraCF.contable = td.codigo_contable
  if (esValorContableValido(td.codigo_interno)) extraCF.interno = td.codigo_interno
}
```

El spread `extraCF` se pasa a `actualizarMovimientoBD` junto con los demás campos.

### 21.5 — Fase 2 (`llena_template`): escritura de contable/interno

La función `crearCuotaEnTemplate()` fue modificada para retornar los códigos contables (cuando aplican), y el motor los incluye en el update del extracto:

```typescript
// En crearCuotaEnTemplate():
const t = template as any
const aplicar = debeAplicarCodigos(t, cuenta)
return {
  templateId: template.id,
  cuotaId: cuota.id,
  ...(aplicar && esValorContableValido(t.codigo_contable) && { contable: t.codigo_contable }),
  ...(aplicar && esValorContableValido(t.codigo_interno) && { interno: t.codigo_interno })
}

// En el loop principal — spread sobre extraRegla:
const extraRegla = {
  ...cuotaResult.contable ? { contable: cuotaResult.contable } : {},
  ...cuotaResult.interno ? { interno: cuotaResult.interno } : {}
}
```

### 21.6 — Correcciones manuales en `msa_galicia`

Durante el análisis, se detectaron 3 movimientos con valores incorrectos o faltantes:

```sql
-- Orden 13: Retiro MA mensual → asiento contable correcto
UPDATE msa_galicia SET contable = 'CTA MA', interno = 'DIST MA' WHERE orden = 13;

-- Órdenes 38-39: Saldo Tarjeta VISA y Saldo Anterior Tarjeta → requieren desglose
UPDATE msa_galicia SET contable = 'Desglosar', interno = 'Desglosar' WHERE orden IN (38, 39);
```

---

## 22. CONFIGURADOR CONTABLE E INTERNO (2026-03-27)

### 22.1 — Contexto y decisión de arquitectura

Existía una tabla `reglas_contable_interno` pero estaba **vacía y desconectada del motor**. En lugar de conectarla, se decidió usar directamente `egresos_sin_factura` como fuente de verdad para las reglas contables — los campos `codigo_contable`, `codigo_interno`, `seccion_regla` ya estaban ahí.

La tabla `reglas_contable_interno` se mantiene intacta en BD pero no se usa.

### 22.2 — Estructura del configurador

El componente `components/configurador-reglas-contable.tsx` fue reescrito completamente. La nueva arquitectura tiene **tres secciones**:

| Sección | Color UI | Contenido | Criterio |
|---------|----------|-----------|---------|
| **Sección 1 — Regla fija** | Azul | Templates con `seccion_regla = 1` | Siempre escriben contable/interno |
| **Sección 2 — Por responsable** | Ámbar | Templates con `seccion_regla = 2` | Escriben solo si empresa ≠ responsable |
| **Sin regla** | Gris (colapsable) | Templates con `seccion_regla = NULL` y valores reales | Pool para asignar |

**Filtros de la vista**:
- Checkbox "Mostrar inactivos": por defecto solo se ven templates activos (`activo = true`)
- "Sin regla" es colapsable (oculta por defecto para no contaminar la vista)

### 22.3 — Agrupación por `grupo_impuesto_id`

Los templates que comparten `grupo_impuesto_id` son **pares** (ejemplo: "Inmobiliario Cuota PAM" y "Inmobiliario Anual PAM" tienen el mismo `grupo_impuesto_id`). La regla contable/interno debe ser la misma para todos los miembros del grupo.

**Comportamiento del configurador**:
- Agrupa templates por `grupo_impuesto_id` en la UI → muestra una sola fila por grupo
- Al editar cualquier campo (contable, interno, responsable), el update se aplica a **todos los IDs del grupo**
- Si el grupo tiene un solo template, se comporta igual (el array `ids[]` tiene un elemento)

**Interface de fila**:
```typescript
interface FilaTabla {
  key: string                    // grupo_impuesto_id o id del template
  nombre: string                 // nombre del grupo o del template
  ids: string[]                  // todos los IDs del grupo
  responsable: string | null
  codigo_contable: string | null
  codigo_interno: string | null
  seccion_regla: number | null
  tieneActivo: boolean           // si al menos uno del grupo está activo
  esGrupo: boolean               // si agrupa más de un template
}
```

### 22.4 — Análisis de consistencia de pares (resultado)

Se verificó via SQL si todos los templates que comparten `grupo_impuesto_id` tienen los mismos valores de `responsable`, `codigo_contable` e `codigo_interno`.

**Resultado**: No existen conflictos reales. Los 11 grupos que mostraban diferencias tenían únicamente variantes de `null` vs `"No Lleva"` — semánticamente equivalentes, ningún par tiene dos valores distintos reales. El `responsable` es siempre consistente dentro de cada grupo.

Conclusión: **se puede editar cualquier miembro del grupo y sincronizar todo el grupo sin riesgo de pisar valores reales con vacíos** — todos los miembros ya tienen el mismo valor efectivo.

### 22.5 — "No Lleva" vs null

`"No Lleva"` es un valor placeholder que significa "este template no tiene código contable/interno". Semánticamente equivale a `null`. El motor (`esValorContableValido`) los trata igual — ambos se descartan.

En el configurador, la función `esValorReal()` aplica la misma lógica: no muestra "No Lleva" como si fuera un código real ni lo cuenta como template con regla asignada.

### 22.6 — Commits de esta sesión

| Commit | Descripción |
|--------|-------------|
| `2c9a9da` | Motor: `esValorContableValido` + `debeAplicarCodigos` + Fase 1 + Fase 2 escritura contable/interno |
| `5e05b18` | BD: migración columna `seccion_regla` + auto-asignación 23 templates + correcciones manuales órdenes 13/38/39 |
| `82e47ab` | Configurador: reescritura completa con secciones 1/2/sin-regla + grupo_impuesto_id sync |

---

## 23. CÓDIGOS CONTABLE/INTERNO EN REGLAS DE CONCILIACIÓN (2026-03-28)

### 23.1 — Problema que resuelve

El sistema de `seccion_regla` en templates (sección 21) tiene un límite: cada template tiene **un solo par de códigos** contable/interno. Con 3 empresas (MSA, PAM, MA), el mismo template puede ser pagado por distintas empresas y cada una necesita un código diferente:

```
Template "Expensas Libertad" — responsable: PAM
  MSA paga PAM → desde MSA: "RET 3 PAM"
  MA  paga PAM → desde MA:  código diferente
  PAM paga PAM → no se asienta nada
```

Un solo `codigo_contable` en el template no puede representar las tres situaciones.

### 23.2 — Solución: códigos en la regla de conciliación

Las `reglas_conciliacion` ya tienen `cuenta_bancaria_id` — cada cuenta tiene su propio set. Al agregar `codigo_contable` y `codigo_interno` directamente a cada regla, el código queda explícito por cuenta:

```
Regla "EXPENSAS LIBERTAD" — cuenta: msa_galicia → codigo_contable = 'RET 3 PAM'
Regla "EXPENSAS LIBERTAD" — cuenta: pam_galicia → codigo_contable = 'AP 3 MSA'
Regla "EXPENSAS LIBERTAD" — cuenta: ma_galicia  → codigo_contable = 'RET 3 MA'
```

Sin lógica condicional — cada cuenta dice exactamente qué escribir.

### 23.3 — BD: columnas nuevas en `reglas_conciliacion`

**Migración aplicada** (commit `eb6ec94`):

```sql
ALTER TABLE reglas_conciliacion
ADD COLUMN IF NOT EXISTS codigo_contable VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS codigo_interno VARCHAR(50) DEFAULT NULL;
```

Ambos campos son opcionales (`NULL`). Las 40 reglas existentes de MSA quedan con `NULL` — el motor cae al fallback de `seccion_regla` del template, que ya funciona para MSA.

### 23.4 — Nueva jerarquía de prioridad en el motor

El motor aplica la siguiente jerarquía para determinar `contable`/`interno`:

```
PRIORIDAD 1 — Códigos de la regla de conciliación
  → Si la regla que matcheó tiene codigo_contable/codigo_interno → usar esos

PRIORIDAD 2 — seccion_regla del template (fallback)
  → Si la regla no tiene códigos propios → usar los del template según seccion_regla
  → Si no hay template → no se escribe nada
```

Esta jerarquía aplica tanto a **Fase 1** como a **Fase 2**:

**Fase 1 (Cash Flow match)**:
```typescript
// Después de encontrar el match en Cash Flow:
// 1. Buscar si alguna regla también matchea el movimiento
const reglaQueMatcheaF1 = reglas.find(r => evaluarRegla(movimiento, r))
if (reglaQueMatcheaF1 && tiene códigos válidos) {
  → usar códigos de la regla  // PRIORIDAD 1
} else if (origen === 'TEMPLATE') {
  → consultar seccion_regla del template  // PRIORIDAD 2
}
```

**Fase 2 (regla matchea directamente)**:
```typescript
// La regla que matcheó:
const codigosRegla = { contable: regla.codigo_contable, interno: regla.codigo_interno }
// Se aplican al primer update (junto con categ/detalle/estado)

// Si la regla también llena_template:
// → crearCuotaEnTemplate() retorna códigos del template
// → solo se usan como fallback si la regla no tenía códigos propios
if (!codigosRegla.contable && cuotaResult.contable) extraRegla.contable = cuotaResult.contable
```

### 23.5 — Configurador de reglas: campos nuevos

El modal crear/editar de `configurador-reglas.tsx` tiene una nueva sección "Códigos contables" con dos campos opcionales:

- **Contable**: texto libre — ej: `RET 3 PAM`, `AP 3 MSA`, `LIB`
- **Interno**: texto libre — ej: `DIST MA`, `CTA JMS`

Descripción visible en el modal: *"Específicos para esta cuenta bancaria. Tienen prioridad sobre los códigos del template."*

En la **lista de reglas**: si una regla tiene códigos asignados, aparecen en verde (`text-emerald-600`) debajo del categ/detalle. Reglas sin códigos no muestran nada — comportamiento igual al anterior.

### 23.6 — `seccion_regla` del template: rol actualizado

Con este cambio, `seccion_regla` pasa a ser **fallback** en lugar de fuente principal:

| Escenario | Fuente de códigos |
|-----------|-----------------|
| Regla tiene `codigo_contable`/`codigo_interno` | **Regla** (principal) |
| Regla sin códigos + template con `seccion_regla` | **Template** (fallback) |
| Regla sin códigos + template sin `seccion_regla` | Sin asiento |

Para **MSA hoy**: todas las reglas tienen `NULL` en los nuevos campos → el motor usa `seccion_regla` del template exactamente como antes. Sin cambio funcional.

### 23.7 — Cómo usar cuando lleguen PAM y MA

1. Crear set de reglas de conciliación para cada cuenta nueva (`cuenta_bancaria_id = 'pam_galicia'`, `'pam_galicia_cc'`, etc.)
2. Al crear cada regla, completar `Contable` e `Interno` según el código que corresponde desde la perspectiva de esa cuenta
3. Las reglas de MSA no se tocan — cada cuenta tiene su propio set independiente

Ejemplo para "Expensas Libertad" con las 3 empresas configuradas:

| Cuenta | Regla texto | Contable | Interno |
|--------|-------------|---------|---------|
| msa_galicia | "EXPENSAS LIBERTAD" | RET 3 PAM | — |
| pam_galicia | "EXPENSAS LIBERTAD" | AP 3 MSA | — |
| ma_galicia | "EXPENSAS LIBERTAD" | RET 3 MA | — |

### 23.8 — Paso futuro: pre-llenado desde `medio_pago`

Cuando el usuario marca una cuota como pagada y especifica el banco (`medio_pago`), el sistema ya tiene suficiente información para pre-determinar los códigos antes de que llegue el extracto bancario:

```
cuota.medio_pago = 'msa_galicia'  →  empresa pagadora = MSA
template.responsable = 'PAM'
→ buscar regla: cuenta_bancaria_id='msa_galicia' + categ del template
→ pre-llenar cuota.contable + cuota.interno
```

No implementado aún — pendiente como mejora futura independiente.

### 23.9 — Commits

| Commit | Descripción |
|--------|-------------|
| `eb6ec94` | BD + motor + configurador: códigos contable/interno en reglas por cuenta bancaria |
| `eea71a9` | Sistema reglas_contable_interno como fuente primaria — motor + configurador Tab2 reescritos |

---

## 24. SISTEMA `reglas_contable_interno` — FUENTE PRIMARIA CONTABLE/INTERNO

> **Fecha**: 2026-03-28
> **Objetivo**: Reemplazar `seccion_regla` de templates por una tabla dedicada que soporte multi-empresa y sea independiente del template.

### 24.1 — Problema que resuelve

El sistema anterior (`seccion_regla` en `egresos_sin_factura`) tenía un único código contable e interno por template, sin distinción de quién pagaba. Esto no permite manejar el caso:

- MSA paga template de PAM → contable = `RET 3 PAM`
- MA paga template de PAM → contable = `RET 3 MA`

El mismo template necesita códigos distintos según la cuenta bancaria que ejecuta el pago.

### 24.2 — Estructura de la tabla

```sql
reglas_contable_interno (
  id UUID PRIMARY KEY,
  cuenta_bancaria_id VARCHAR(50) NOT NULL,  -- 'msa_galicia', 'pam_galicia', etc.
  tipo_regla VARCHAR(20) NOT NULL,          -- 'especifica' | 'responsable'
  template_id UUID NULL,                    -- solo para tipo='especifica'
  responsable VARCHAR(50) NULL,             -- solo para tipo='responsable'
  codigo_contable VARCHAR(50) NULL,
  codigo_interno VARCHAR(50) NULL,
  descripcion VARCHAR(200) NULL,
  activo BOOLEAN DEFAULT true,
  orden INT
)
```

Constraints:
- `chk_tipo_regla`: tipo_regla IN ('especifica', 'responsable')
- `chk_campos_por_tipo`: especifica requiere template_id; responsable requiere responsable

### 24.3 — Dos tipos de regla

**Tipo A — Específica** (`tipo_regla = 'especifica'`):
- Identifica: `cuenta_bancaria_id` + `template_id` → `codigo_contable` + `codigo_interno`
- Ejemplo: MSA Galicia + Template "Expensas Libertad" → LIB / DIST MA
- Uso: cuando se sabe exactamente qué template paga esta cuenta
- Mayor prioridad

**Tipo B — Responsable** (`tipo_regla = 'responsable'`):
- Identifica: `cuenta_bancaria_id` + `responsable` → `codigo_contable` + `codigo_interno`
- Ejemplo: MSA Galicia + responsable "PAM" → RET 3 PAM / —
- Uso: para casos cross-company donde todos los templates de un responsable tienen el mismo tratamiento contable cuando los paga una cuenta de otra empresa
- Solo aplica cuando empresa pagadora ≠ responsable del template
- Menor prioridad que Tipo A

### 24.4 — Jerarquía de prioridad completa

Al conciliar un movimiento, el motor aplica contable/interno con esta prioridad:

```
1. Tab 2 Tipo A (reglas_contable_interno, especifica, cuenta+template)  ← MÁS ESPECÍFICO
2. Tab 2 Tipo B (reglas_contable_interno, responsable, cuenta+responsable)
3. Tab 1 (codigo_contable/interno en regla de texto — campo opcional en reglas_conciliacion)
4. seccion_regla del template en egresos_sin_factura  ← LEGACY, se mantiene como fallback
```

### 24.5 — Implementación en el motor

Función nueva en `useMotorConciliacion.ts`:

```typescript
const buscarCodigosContableInterno = async (
  cuentaId: string,
  templateId?: string | null,
  responsable?: string | null
): Promise<{ contable?: string; interno?: string }> => {
  // Tipo A: cuenta + template
  if (templateId) {
    const { data } = await supabase.from('reglas_contable_interno')
      .select('codigo_contable, codigo_interno')
      .eq('cuenta_bancaria_id', cuentaId).eq('tipo_regla', 'especifica')
      .eq('template_id', templateId).eq('activo', true).maybeSingle()
    if (data && (esValorContableValido(data.codigo_contable) || esValorContableValido(data.codigo_interno)))
      return { contable: ..., interno: ... }
  }
  // Tipo B: cuenta + responsable
  if (responsable) { ... }
  return {}
}
```

**Fase 1 (Cash Flow match) — TEMPLATE**:
1. Consulta template para obtener responsable
2. Llama `buscarCodigosContableInterno(cuenta.id, egreso_id, responsable)`
3. Si Tab2 no da resultados: busca regla de texto que matchee (Tab 1)
4. Si Tab1 tampoco: usa seccion_regla legacy

**Fase 2 (regla de texto match) — con llena_template**:
1. Crea cuota en template → obtiene templateId + responsable
2. Llama `buscarCodigosContableInterno(cuenta.id, templateId, responsable)`
3. Si Tab2 no da resultados: usa codigosRegla (Tab 1)
4. Si Tab1 tampoco: usa seccion_regla desde `crearCuotaEnTemplate`

### 24.6 — Datos migrados

Al activar el nuevo sistema se migraron los 18 templates con `seccion_regla` y códigos reales como reglas Tipo A para `msa_galicia`:

| Template | Contable | Interno |
|----------|----------|---------|
| ABL Cochera Libertad | LIB | DIST MA |
| ABL Libertad | LIB | DIST MA |
| AYSA Libertad | LIB | DIST MA |
| Expensas Libertad | LIB | DIST MA |
| Metrogas Libertad | LIB | DIST MA |
| Retiro Andres | DIST AMS | DIST AMS |
| Retiro Jose | DIST JMS | DIST JMS |
| Retiro MA mensual | CTA MA | DIST MA |
| Retiro Manuel | DIST MANU | DIST MANU |
| Retiro Mechi | DIST MECHI | DIST MECHI |
| Retiro Soledad | DIST SOLE | DIST SOLE |
| Seguro Flota | — | Desglosar |
| Sueldo AMS | CTA AMS | — |
| Sueldo JMS | CTA JMS | — |
| Tarjeta Visa Business MSA | Desglosar | Desglosar |
| Tarjeta VISA PAM | Desglosar | Desglosar |
| Imp Automotores Gol | — | DIST JMS |
| Imp Automotores Tiguan | — | DIST MA |

`seccion_regla` queda en la tabla como columna legacy (fallback de prioridad 4). No se elimina.

### 24.7 — UI Configurador Tab 2

Componente: `components/configurador-reglas-contable.tsx`

Muestra dos secciones:

**Sección Tipo A (azul):** tabla con template name, contable, interno — inline editing + eliminar
**Sección Tipo B (amber):** tabla con responsable, contable, interno — inline editing + eliminar
**Modal crear/editar:** formulario adaptativo según tipo (selector template vs campo responsable), dos inputs de código, descripción opcional

Acepta prop `cuentaBancariaId?: string` para sincronizarse con selector del padre. Si no recibe prop, muestra su propio selector.

### 24.8 — Uso para PAM y MA (próxima fase)

Cuando se activen bancos PAM y MA, crear reglas Tipo B en cada cuenta:

```
PAM Galicia CA  + responsable="MSA" → contable="RET 3 MSA", interno="—"
PAM Galicia CA  + responsable="MA"  → contable="RET 3 MA",  interno="—"
MA Galicia (futuro) + responsable="PAM" → según convenio
```

Las reglas Tipo A se crean a medida que se descubran tratamientos específicos por template + cuenta.

---

## 25. PENDIENTES Y DEPRECACIONES

> **Fecha**: 2026-03-28

### 25.1 — Pendientes de implementación

#### 🥇 PRIORIDAD 1 — Modal asignación manual extracto

Movimientos con estado `Pendiente` o `Auditar` en `vista-extracto-bancario.tsx` necesitan un modal para asignación manual cuando el motor automático no resuelve.

**Dos caminos posibles (el usuario elige):**

**Camino A — Factura ARCA:**
- Buscar factura por fecha/monto/proveedor en `msa.comprobantes_arca`
- Al vincular: auto-llena `comprobante_arca_id` + `nro_cuenta` (si la factura tiene cuenta contable asignada)
- Estado final: `conciliado`

**Camino B — Template:**
- Buscar template por nombre en `egresos_sin_factura`
- Al vincular: crea cuota + llena `template_id` + `template_cuota_id` + `categ`
- Aplica `reglas_contable_interno` (Tipo A→B) para `contable`/`interno`
- Estado final: `conciliado`

**Regla UX:** el usuario nunca ingresa IDs ni códigos — solo busca por nombre. El monto se pre-llena desde el movimiento (débito o crédito).

---

#### 🥈 PRIORIDAD 2 — Separar templates bancarios por empresa

Hoy los 14 templates de gastos e impuestos bancarios tienen `responsable = 'MSA / PAM'` (ambiguo). El motor no puede filtrar correctamente por empresa.

**Acción:** crear versiones separadas:
- 14 templates × 3 empresas (MSA, PAM, MA) = 42 templates
- Cada versión con `responsable` correcto: `'MSA'`, `'PAM'`, `'MA'`
- Desactivar los templates actuales con `responsable = 'MSA / PAM'`

---

#### 🥉 PRIORIDAD 3 — Reglas de conciliación para PAM y MA

Cuando se activen los bancos PAM Galicia y futuros bancos MA:
- Crear reglas en `reglas_conciliacion` para `pam_galicia` y `pam_galicia_cc` (el extracto PAM usa textos distintos al MSA)
- Crear reglas Tipo B en `reglas_contable_interno`:
  - `pam_galicia` + responsable=`MSA` → contable=`RET 3 MSA`
  - `pam_galicia` + responsable=`MA` → contable=`RET 3 MA`

---

#### Menor — Selector cuenta compartido Tab 1 + Tab 2

En `vista-extracto-bancario.tsx` cada tab tiene su propio selector. Refactorizar para un selector único en el padre pasado como prop a ambos componentes. `ConfiguradorReglasContable` ya acepta `cuentaBancariaId?: string`. Falta ajustar `ConfiguradorReglas` y el padre.

---

### 25.2 — Pendientes de desactivar (desarrollado, cambiamos de enfoque)

#### Sistema `seccion_regla` en `egresos_sin_factura`

**Qué es:** sistema original de contable/interno. Cada template tenía `seccion_regla` (1=siempre, 2=cross-company), `codigo_contable` e `codigo_interno`. Era la única fuente de códigos.

**Por qué se reemplazó:** un único código por template no permite diferenciar quién paga. Si MSA paga template de PAM el código difiere de si MA paga el mismo template. El nuevo sistema `reglas_contable_interno` resuelve esto con `cuenta_bancaria_id` por fila.

**Estado actual:** sigue activo como **prioridad 4 (fallback legacy)** en el motor. Las 18 reglas existentes ya fueron migradas a `reglas_contable_interno` (Tipo A, `msa_galicia`).

**Qué desactivar cuando el nuevo sistema esté validado:**

**1. Motor** `hooks/useMotorConciliacion.ts`:
- Fase 1 — eliminar bloque `// Prioridad 3: seccion_regla del template (legacy fallback)` (~líneas 368-374)
- `crearCuotaEnTemplate` — eliminar retorno de `contable`/`interno` desde seccion_regla (~líneas 557-562)
- Helper `debeAplicarCodigos()` — eliminar función completa (~líneas 88-100)
- En el SELECT de Fase 1 cambiar `.select('codigo_contable, codigo_interno, seccion_regla, responsable')` → `.select('responsable')`

**2. BD** — columnas en `egresos_sin_factura` se pueden poner a NULL y luego eliminar:
```sql
ALTER TABLE egresos_sin_factura
  DROP COLUMN seccion_regla,
  DROP COLUMN codigo_contable,
  DROP COLUMN codigo_interno;
```

**Condición para desactivar:** confirmar que `reglas_contable_interno` cubre todos los templates activos de todas las empresas (MSA, PAM, MA) y que no hay conciliaciones reales que dependan del fallback.

> **Actualización 2026-03-28:** el fallback a `seccion_regla` fue eliminado del motor (commit `a77c949`). Las columnas en `egresos_sin_factura` aún existen pero el motor ya no las lee. Solo quedan como referencia histórica hasta que se decida hacer el DROP.

---

## 26. ARQUITECTURA FINAL — ROL DE TAB 1 Y TAB 2

> **Fecha**: 2026-03-28

Tab 1 y Tab 2 **no compiten** — tienen roles distintos y complementarios.

### 26.1 — Qué hace cada tab

**Tab 1 — Reglas de Conciliación** (`reglas_conciliacion`):
- Motor de **clasificación**: define cuándo un movimiento hace match (por texto en descripción, CUIT, monto)
- Al hacer match asigna: `categ`, `centro_costo`, `detalle`, `estado`
- Opcionalmente puede tener `codigo_contable`/`codigo_interno` propios (campo adicional, para edge cases)
- Es la fuente de Fase 2

**Tab 2 — Contable e Interno** (`reglas_contable_interno`):
- Motor de **códigos**: define qué `contable`/`interno` se anota en el extracto
- No clasifica movimientos — solo provee códigos cuando ya se sabe qué template está involucrado
- Opera por `cuenta_bancaria_id` + `template_id` (Tipo A) o `cuenta_bancaria_id` + `responsable` (Tipo B)
- Cada regla es para una sola cuenta bancaria — no hay mezcla entre empresas

### 26.2 — Flujo completo por fase

**Fase 1 — Match por monto+fecha (Cash Flow):**
1. El movimiento coincide con una cuota de template o factura ARCA por monto y ventana de fechas
2. Categ/detalle/centro_costo vienen del registro Cash Flow (no de reglas de texto)
3. Para códigos contable/interno:
   - **Tab 2 primero**: busca regla en `reglas_contable_interno` para esta cuenta + template (Tipo A), luego cuenta + responsable (Tipo B)
   - **Tab 1 secundario**: si Tab 2 no tiene nada, busca si alguna regla de texto también matchea el movimiento y tiene códigos propios
4. Si ninguno tiene códigos → contable/interno quedan vacíos (sin asignación silenciosa)

**Fase 2 — Match por texto (Tab 1):**
1. Una regla de Tab 1 hace match por texto → asigna categ/detalle/estado
2. Si la regla tiene `llena_template=true`:
   - Crea una cuota nueva en el template correspondiente
   - Consulta Tab 2 para los códigos (Tipo A → Tipo B)
   - Tab 2 tiene prioridad — sobreescribe los códigos propios de la regla si los tiene
3. Si la regla tiene `llena_template=false` (gastos bancarios, impuestos):
   - Solo aplican los códigos propios de la regla (campo `codigo_contable`/`codigo_interno` de Tab 1)
   - No se consulta Tab 2 (no hay template involucrado)

### 26.3 — Prioridad de códigos (resumen)

```
Fase 1 (CF match):   Tab 2 (A→B)  >  Tab 1 código en regla  >  vacío
Fase 2 llena=true:   Tab 2 (A→B)  >  Tab 1 código en regla  >  vacío
Fase 2 llena=false:  Tab 1 código en regla  >  vacío
```

Tab 2 siempre tiene mayor prioridad que Tab 1 para los códigos.

### 26.4 — Independencia por empresa

Cada regla en `reglas_contable_interno` tiene `cuenta_bancaria_id` explícito. Una regla de `msa_galicia` nunca aplica a `pam_galicia`. Las empresas son completamente independientes. Hoy solo existen reglas para `msa_galicia` (18 Tipo A). PAM y MA se configurarán cuando sus bancos se activen.
