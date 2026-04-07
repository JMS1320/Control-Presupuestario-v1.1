# ARQUITECTURA BASE DE DATOS — Documentación Técnica

> **Fecha creación**: 2026-03-22
> **Propósito**: Referencia completa para debugging de problemas de acceso a BD, especialmente el error "Invalid schema: pam"

---

## 1. SCHEMAS EN SUPABASE

El proyecto usa **3 schemas** en PostgreSQL:

| Schema | Propósito | Acceso desde código |
|--------|-----------|---------------------|
| `public` | Tablas compartidas y extractos bancarios | `supabase.from('tabla')` |
| `msa` | Facturas ARCA empresa MSA | `supabase.schema('msa').from('tabla')` |
| `pam` | Facturas ARCA empresa PAM | `supabase.schema('pam').from('tabla')` ← **🚨 PROBLEMA** |

---

## 2. INVENTARIO COMPLETO DE TABLAS

### Schema `public` (funciona correctamente)

| Tabla | Descripción |
|-------|-------------|
| `msa_galicia` | Extracto bancario MSA Galicia CC Pesos |
| `pam_galicia` | Extracto bancario PAM Galicia CA Pesos |
| `pam_galicia_cc` | Extracto bancario PAM Galicia CC Pesos |
| `egresos_sin_factura` | Templates de egresos (maestro) |
| `cuotas_egresos_sin_factura` | Cuotas de templates |
| `reglas_conciliacion` | Reglas automáticas de matching bancario |
| `cuentas_contables` | Catálogo de cuentas contables |
| `anticipos_proveedores` | Anticipos de Cash Flow |
| `tipos_comprobante_afip` | 68 tipos de comprobante AFIP |
| `tipos_sicore_config` | Configuración retenciones SICORE |
| `indices_ipc` | Índices IPC para ajuste de sueldos |
| `sueldos_empleados` | Empleados y parámetros de sueldos |
| `periodos_sueldos` | Períodos de liquidación de sueldos |
| `reglas_contable_interno` | Reglas automáticas campos contable/interno |

### Schema `msa` (funciona correctamente)

| Tabla | Descripción |
|-------|-------------|
| `msa.comprobantes_arca` | Facturas ARCA empresa MSA |
| `msa.comprobantes_historico` | Facturas históricas empresa MSA |

### Schema `pam` (🚨 PROBLEMA — HTTP 406 al acceder desde código)

| Tabla | Descripción |
|-------|-------------|
| `pam.comprobantes_arca` | Facturas ARCA empresa PAM |
| `pam.comprobantes_historico` | Facturas históricas empresa PAM (creada 2026-03-22) |

---

## 3. CÓMO EL CÓDIGO ACCEDE A CADA SCHEMA

### Cliente Supabase (`lib/supabase.ts`)

```typescript
// Creación simple — sin configuración especial de schemas
const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Importante**: NO hay lista de schemas en el cliente. La gestión de schemas está 100% del lado del servidor (PostgREST / Supabase).

### Acceso a public (siempre funciona)

```typescript
// Extractos bancarios — schema public
supabase.from('msa_galicia').select('*')
supabase.from('pam_galicia').select('*')
```

### Acceso a msa (funciona)

```typescript
// En vista-facturas-arca.tsx, cuando empresa='MSA'
const schemaName = 'msa'
supabase.schema('msa').from('comprobantes_arca').select('*')
supabase.schema('msa').from('comprobantes_historico').select('*')
```

### Acceso a pam (🚨 NO FUNCIONA — HTTP 406)

```typescript
// En vista-facturas-arca.tsx, cuando empresa='PAM'
const schemaName = 'pam'
supabase.schema('pam').from('comprobantes_arca').select('*')
// → Error: "Invalid schema: pam"   HTTP 406
```

---

## 4. DÓNDE SE USA CADA SCHEMA EN EL CÓDIGO

### `components/vista-facturas-arca.tsx`

**Línea 230**: Determina schema según empresa prop
```typescript
export function VistaFacturasArca({ empresa = 'MSA' }: { empresa?: 'MSA' | 'PAM' } = {}) {
  const schemaName = empresa === 'PAM' ? 'pam' : 'msa'
```

**Líneas 540-542**: Carga facturas usando el schema
```typescript
const [arcaResult, historicoResult] = await Promise.all([
  supabase.schema(schemaName).from('comprobantes_arca').select('*'),
  supabase.schema(schemaName).from('comprobantes_historico').select('*'),
])
```

**Llamada desde vista-egresos.tsx** (tab "Facturas PAM"):
```tsx
<VistaFacturasArca empresa="PAM" />
// → schemaName = 'pam' → falla con 406
```

**Llamada desde vista-egresos.tsx** (tab "Facturas MSA"):
```tsx
<VistaFacturasArca empresa="MSA" />
// → schemaName = 'msa' → funciona OK
```

### `components/vista-extracto-bancario.tsx`

Línea 247 (hardcodeado a msa por error residual):
```typescript
const tablaActual = cuentaSeleccionada || 'msa_galicia'
await supabase.schema('msa').from('comprobantes_arca').update(...)
```
Este hardcodeo es un problema separado: siempre actualiza `msa.comprobantes_arca` aunque la cuenta seleccionada sea PAM.

### `hooks/useMovimientosBancarios.ts`

```typescript
// HARDCODEADO — problema conocido independiente del error 406
let query = supabase.from('msa_galicia').select('*')
// No usa cuentaSeleccionada ni acepta parámetro de tabla
```

---

## 5. 🚨 PROBLEMA PRINCIPAL: Error "Invalid schema: pam" (HTTP 406)

### Síntoma exacto

- **Vista**: Egresos → tab "Facturas PAM"
- **Error mostrado**: "Error al cargar facturas: Invalid schema: pam"
- **HTTP code**: 406 (Not Acceptable)
- **Cuándo ocurre**: Al intentar `supabase.schema('pam').from('comprobantes_arca')`

### Lo que significa HTTP 406 en PostgREST

PostgREST retorna 406 cuando el schema solicitado **NO está en su lista de schemas permitidos** (`db-schemas`). Esto es diferente a un problema de permisos (que sería 403) o de tabla inexistente (404).

### Todo lo verificado y descartado

| Verificación | Resultado | Descartado como causa |
|---|---|---|
| Schema `pam` existe en PostgreSQL | ✅ Existe | — |
| Tabla `pam.comprobantes_arca` existe | ✅ Existe | — |
| Tabla `pam.comprobantes_historico` existe | ✅ Creada 2026-03-22 | — |
| USAGE privilege en schema `pam` para rol `anon` | ✅ Tiene permisos | — |
| SELECT privilege en tabla `pam.comprobantes_arca` para `anon` | ✅ Tiene permisos | — |
| Schema `pam` aparece en "Exposed Schemas" del Dashboard | ✅ Está configurado | ← **NO resolvió** |
| `pg_notify('pgrst', 'reload config')` ejecutado | ✅ Ejecutado | ← **NO resolvió** |
| Pause/Resume del proyecto Supabase | ✅ Ejecutado | ← **NO resolvió** |
| Último deploy en Vercel tiene código correcto | ✅ Commit 69a686a | — |
| `authenticator` tiene USAGE en schema `pam` | ❌ FALSE (verificado por SQL) | ← descartado como causa: `msa` también es FALSE y funciona |
| `authenticator` tiene USAGE en schema `msa` | ❌ FALSE (verificado por SQL) | ← descartado: `authenticator` hereda de `anon` que sí tiene USAGE |
| `anon` tiene USAGE en schema `pam` | ✅ TRUE (verificado por SQL) | ← descartado como causa del error |
| `anon` tiene USAGE en schema `msa` | ✅ TRUE (verificado por SQL) | ← descartado como causa del error |
| Grants en tablas `pam` vs `msa` son idénticos | ✅ Idénticos para anon/authenticated/service_role | ← descartado |
| Owner de ambos schemas | ✅ Ambos son `postgres` | ← descartado |
| RLS en `pam.comprobantes_arca` | ❌ Desactivado (msa tiene RLS activo) | ← no causa 406 |
| `authenticator` hereda roles | hereda de `anon`, `authenticated`, `service_role` | ← no es el problema |

### Conclusión confirmada por SQL

**Todo lo verificable a nivel PostgreSQL es idéntico entre `msa` y `pam`**. El problema es exclusivamente de configuración de PostgREST (la capa HTTP que Supabase pone delante de la BD). El schema `pam` no está en la lista interna `db-schemas` de PostgREST, sin importar lo que muestre el Dashboard de Supabase.

**El error ocurre en la carga inicial del componente** — antes de que SICORE, Pagos, u otras funciones sean invocables. Los botones de la UI no tienen ningún rol en el problema.

### Hipótesis abiertas al cerrar sesión

**Hipótesis A** — El schema `pam` en Exposed Schemas no se persiste correctamente:
- El Dashboard puede mostrar que está guardado pero no reflejarse en la configuración de PostgREST
- Los servicios de Supabase managed pueden tener delay extra o mecanismo diferente al OSS

**Hipótesis B** — El schema `msa` funciona pero `pam` no: diferencia de permisos a nivel de rol de base de datos:
- Posiblemente `msa` fue creado de una forma y `pam` de otra (en reconstrucción de BD)
- Verificar: `GRANT USAGE ON SCHEMA pam TO authenticator;` y `GRANT USAGE ON SCHEMA pam TO service_role;` — no solo `anon`
- PostgREST usa el rol `authenticator` internamente

**Hipótesis C** — El cliente JavaScript supabase-js `schema()` solo funciona para schemas listados en la configuración de PostgREST, y hay algún caché difícil de invalidar en Supabase managed:
- Diferente al OSS donde `pg_notify` es suficiente

**Hipótesis D** — El problema no está en PostgREST sino en el schema `pam` mismo:
- Posible inconsistencia entre cómo fue creado `msa` vs `pam` en la reconstrucción de BD
- Verificar owner del schema: `SELECT n.nspname, pg_get_userbyid(n.nspowner) FROM pg_namespace WHERE nspname IN ('msa', 'pam');`

### Solución alternativa propuesta (no implementada)

**Mover las tablas PAM al schema `public`:**

```sql
-- En lugar de schema pam separado:
-- pam.comprobantes_arca → public.pam_comprobantes_arca
-- pam.comprobantes_historico → public.pam_comprobantes_historico

ALTER TABLE pam.comprobantes_arca SET SCHEMA public;
ALTER TABLE pam.comprobantes_historico SET SCHEMA public;
ALTER TABLE public.comprobantes_arca RENAME TO pam_comprobantes_arca;
ALTER TABLE public.comprobantes_historico RENAME TO pam_comprobantes_historico;
```

Luego en el código:
```typescript
// En vez de supabase.schema('pam').from('comprobantes_arca')
supabase.from('pam_comprobantes_arca').select('*')
// Igual que msa_galicia en schema public — funciona siempre
```

**Ventajas**: Elimina la dependencia de schemas adicionales en PostgREST. Consistente con el patrón ya usado para extractos bancarios (todas en public).

**Desventaja**: Pierde el namespace semántico pam/msa para las facturas.

---

## 6. PROBLEMA SECUNDARIO: Extracto Bancario sin botón para cambiar cuenta

### Síntoma

El selector de cuenta se abre SOLO al hacer click en "Conciliación Bancaria" cuando NO hay cuenta seleccionada. Una vez seleccionada una cuenta, no hay botón visible para cambiarla.

### Estado actual del código

```typescript
// El selector solo se abre cuando:
const iniciarConciliacion = () => {
  if (!cuentaSeleccionada) {
    setSelectorAbierto(true)  // ← Solo abre si NO hay cuenta
    return
  }
  // Si ya hay cuenta → corre la conciliación directamente
}

// En el header solo hay un Badge con el nombre:
{cuentaSeleccionada && (
  <Badge variant="outline">
    {cuentasDisponibles.find(c => c.id === cuentaSeleccionada)?.nombre}
  </Badge>
)}
// No hay botón de "cambiar" aquí
```

### Fix simple propuesto

Agregar un botón "Cambiar cuenta" junto al Badge en el header:
```tsx
{cuentaSeleccionada && (
  <>
    <Badge variant="outline">...</Badge>
    <Button variant="ghost" size="sm" onClick={() => setSelectorAbierto(true)}>
      Cambiar
    </Button>
  </>
)}
```

---

## 7. PROBLEMA TERCIARIO: useMovimientosBancarios hardcodeado a msa_galicia

### Descripción

`hooks/useMovimientosBancarios.ts` siempre carga de `msa_galicia`, ignorando qué cuenta está seleccionada en la vista.

```typescript
// Línea 64 — hardcodeado
let query = supabase.from('msa_galicia').select('*')
```

### Impacto

Aunque se seleccione PAM Galicia como cuenta activa en el selector, la tabla de movimientos siempre muestra datos de MSA Galicia.

### Fix propuesto

Convertir a función que acepta parámetro:
```typescript
const cargarMovimientos = async (tabla: string = 'msa_galicia', filtros?: {...}) => {
  let query = supabase.from(tabla).select('*')
  ...
}
```

Y en la vista:
```typescript
const tablaActual = cuentaSeleccionada || 'msa_galicia'
cargarMovimientos(tablaActual, filtros)
```

---

## 8. RELACIONES ENTRE TABLAS

```
public.msa_galicia (extracto) ──────────────────────────────────────► msa.comprobantes_arca
  comprobante_arca_id (FK soft)                                         id

public.pam_galicia (extracto) ──────────────────────────────────────► pam.comprobantes_arca
  comprobante_arca_id (FK soft)                                         id

public.egresos_sin_factura (template maestro) ──────────────────────► public.cuotas_egresos_sin_factura
  id                                                                    egreso_id

public.msa_galicia / pam_galicia ──── conciliación manual ──────────► cuotas_egresos_sin_factura
  (no FK, solo actualiza estado)                                        id, estado='conciliado'

public.reglas_conciliacion ─────────────── aplicadas por motor ────► msa_galicia / pam_galicia
  (tabla separada, motor lee en runtime)

public.anticipos_proveedores ─────── referenciado en Cash Flow ────► lógica de app
```

---

## 9. COMPARACIÓN msa vs pam — Por qué msa funciona y pam no

| Aspecto | msa | pam |
|---------|-----|-----|
| Schema en BD | ✅ Existe | ✅ Existe |
| Tabla `comprobantes_arca` | ✅ Existe | ✅ Existe |
| Tabla `comprobantes_historico` | ✅ Existe | ✅ Creada 2026-03-22 |
| USAGE en schema | ✅ | ✅ (verificado) |
| SELECT en tabla | ✅ | ✅ (verificado) |
| Schema en Exposed Schemas | ✅ | ✅ (configurado, no resolvió) |
| `supabase.schema('X').from(...)` | ✅ Funciona | ❌ HTTP 406 |

**La inconsistencia no tiene explicación obvia** con lo investigado. Ambos schemas parecen idénticos en configuración, pero `msa` funciona y `pam` no.

### Queries diagnóstico para próxima sesión

```sql
-- 1. Verificar owner de los schemas
SELECT n.nspname, pg_get_userbyid(n.nspowner) as owner
FROM pg_namespace
WHERE nspname IN ('msa', 'pam');

-- 2. Verificar todos los grants en pam
SELECT grantee, privilege_type
FROM information_schema.role_usage_grants
WHERE object_schema = 'pam';

-- 3. Verificar grants en tablas pam
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'pam';

-- 4. Comparar grants msa vs pam
SELECT 'msa' as schema, grantee, privilege_type FROM information_schema.role_usage_grants WHERE object_schema = 'msa'
UNION ALL
SELECT 'pam' as schema, grantee, privilege_type FROM information_schema.role_usage_grants WHERE object_schema = 'pam'
ORDER BY schema, grantee;

-- 5. Verificar si authenticator tiene USAGE (crítico para PostgREST)
SELECT has_schema_privilege('authenticator', 'pam', 'USAGE');
SELECT has_schema_privilege('authenticator', 'msa', 'USAGE');
```

---

## 10. ARCHIVOS CLAVE DEL SISTEMA

| Archivo | Propósito |
|---------|-----------|
| `lib/supabase.ts` | Cliente Supabase — sin configuración de schemas |
| `components/vista-facturas-arca.tsx` | Vista facturas MSA y PAM — usa `schema(schemaName)` |
| `components/vista-extracto-bancario.tsx` | Vista extracto — selector de cuenta, conciliación manual |
| `components/vista-egresos.tsx` | Tabs: Facturas MSA / Facturas PAM / Egresos sin Factura |
| `hooks/useMotorConciliacion.ts` | Motor automático + `CUENTAS_BANCARIAS` config |
| `hooks/useMovimientosBancarios.ts` | CRUD movimientos — hardcodeado a `msa_galicia` |
| `hooks/useMultiCashFlowData.ts` | Datos Cash Flow para matching en conciliación |
| `app/api/import-excel/route.ts` | Import extracto Excel → BD (msa_galicia / pam_galicia) |

---

## 11. ESTADO AL CERRAR SESIÓN (2026-03-22)

### ✅ Funcionando
- Import extractos bancarios (fix orden cronológico aplicado)
- Conciliación automática motor (para msa_galicia)
- Vista Facturas MSA (schema msa funciona)
- Selector de cuenta en extracto (aunque con límites)

### ❌ Pendiente resolver
1. **Schema pam HTTP 406** — causa raíz desconocida, todo lo obvio fue verificado
2. **Botón cambiar cuenta** — falta botón en header de extracto bancario
3. **useMovimientosBancarios hardcodeado** — siempre carga msa_galicia

### 🔎 Próximos pasos sugeridos (en orden)

1. **Ejecutar queries diagnóstico** de la sección 9 en Supabase SQL Editor
   - Especialmente: `SELECT has_schema_privilege('authenticator', 'pam', 'USAGE');`
   - Si es `false` → `GRANT USAGE ON SCHEMA pam TO authenticator;` puede ser la solución

2. **Si queries no revelan causa**: Implementar solución alternativa (schema public)
   - Renombrar `pam.comprobantes_arca` → `public.pam_comprobantes_arca`
   - Actualizar código de una línea en `vista-facturas-arca.tsx`

3. **Independientemente**: Arreglar botón cambiar cuenta en extracto bancario

4. **Independientemente**: Hacer `useMovimientosBancarios` dinámico

---

> **Nota**: El problema de schema `pam` es inesperadamente difícil para algo que debería ser simple. La hipótesis más probable sin verificar es que el rol `authenticator` no tiene USAGE en `pam` (a diferencia de `msa`). PostgREST usa `authenticator` internamente — si ese rol no puede ver el schema, retorna 406 aunque `anon` tenga permisos.
