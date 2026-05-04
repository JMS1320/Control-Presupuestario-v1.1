# USUARIOS — ARQUITECTURA DE ROLES Y ACCESO

> Documento de análisis y decisiones sobre el sistema de usuarios, roles y restricciones de escritura.
> **Fecha análisis**: 2026-04-16

---

## 1. ESTADO ACTUAL DEL SISTEMA

### Roles existentes

| Código URL | Rol | Definido en |
|------------|-----|-------------|
| `adminjms1320` | `admin` | `config/access-routes.ts` |
| `ulises` | `contable` | `config/access-routes.ts` |

### Cómo funciona hoy

El rol se determina en `app/[accessRoute]/page.tsx` leyendo la URL y se pasa como prop `userRole` al componente raíz `dashboard.tsx`.

```
URL /adminjms1320  →  userRole = 'admin'   →  ve todas las tabs
URL /ulises        →  userRole = 'contable' →  ve solo tab 'egresos'
```

### Restricciones actualmente implementadas

**En `dashboard.tsx`:**
- Contable solo ve la tab `egresos` (Facturas ARCA + Templates)
- El resto de tabs no se renderiza

**En `vista-facturas-arca.tsx`** (lee URL directamente con `window.location`):
- Solo admin puede cambiar estados en DDJJ IVA
- Solo admin puede editar la fecha de quincena SICORE cuando hay facturas en proceso
- Solo admin ve el botón Revertir (↩) en Vista de Pagos
- Solo admin ve los checkboxes de filtro de estado en Vista de Pagos
- En Vista de Pagos, contable solo ve las secciones PAGAR y PREPARADO (no PENDIENTE)

**Lo que Ulises SÍ puede hacer dentro de Egresos:**
- Editar estados, montos y fechas inline en la tabla de facturas ARCA
- Imputar facturas a períodos contables (DDJJ)
- Generar cierre SICORE
- Editar templates y cuotas
- Todo lo demás dentro de la tab Egresos sin restricción

### Problema identificado

- `userRole` se pasa de `dashboard.tsx` a `VistaEgresos` pero `VistaEgresos` **no recibe el prop** (función sin parámetros)
- El prop se pierde y no llega a los sub-componentes
- Las restricciones existentes en `vista-facturas-arca.tsx` leen el rol directamente de la URL como workaround

---

## 2. NECESIDAD IDENTIFICADA

El usuario quiere un mecanismo donde:
1. **Todo lo que se desarrolle quede restringido por defecto** para no-admin
2. **No haya que recordar agregar restricciones** en cada nueva funcionalidad
3. **Se pueda dar acceso de a poco** (opt-in por feature) en lugar de bloquear de a poco (opt-out)

---

## 3. OPCIONES ANALIZADAS

### Opción B — Wrapper del Cliente Supabase (Proxy JavaScript)

**Concepto**: Interceptar el cliente Supabase con un `Proxy` que bloquea métodos de escritura (`.insert()`, `.update()`, `.delete()`, `.upsert()`) cuando el usuario no es admin.

**Arquitectura**:
```
Componente → supabase.from().update() → Proxy chequea rol → ¿Admin? → BD
                                                           → ¿No admin? → Error silencioso
```

**Ventajas**:
- Cero cambios en los componentes
- Protección automática para features nuevas (si usan el mismo cliente)

**Desventajas**:
- Usa JavaScript `Proxy` — API avanzada, difícil de debuggear
- El query builder de Supabase encadena métodos profundamente; un Proxy sobre un Proxy puede comportarse de forma impredecible
- El cliente Supabase es un singleton inicializado en el servidor (Next.js) donde `window` no existe — el rol no se puede determinar en ese momento
- Maneja `supabase.schema('msa').from(...)` con dificultad

**Seguridad**: Solo UX — `anon key` expuesta en browser, alguien con DevTools puede bypassear

**Veredicto**: Objetivo correcto, implementación frágil. No recomendado.

---

### Opción C — Guard por Función

**Concepto**: Agregar al inicio de cada función que escribe en BD:

```typescript
const esAdmin = window.location.pathname.split('/')[1] === 'adminjms1320'
if (!esAdmin) { alert('Solo el administrador puede realizar esta acción'); return }
```

**Ventajas**:
- Implementación simple y predecible
- Fácil de debuggear
- Bajo riesgo de romper algo existente
- Migración gradual posible

**Desventajas**:
- Hay que **recordarlo** en cada nueva funcionalidad
- No cumple el objetivo principal del usuario (protección automática)
- Código duplicado esparcido por todos lados
- No es seguridad real

**Seguridad**: Solo UX

**Veredicto**: Más simple pero no resuelve el problema de fondo.

---

### Opción D — Hook `useSupabase()`

**Concepto**: Crear un hook que devuelve el cliente real (admin) o un cliente bloqueado (no-admin). Los componentes usan `useSupabase()` en lugar de importar `supabase` directamente.

```typescript
// hooks/useSupabase.ts
export function useSupabase() {
  const esAdmin = window.location.pathname.split('/')[1] === 'adminjms1320'
  return esAdmin ? supabaseReal : supabaseReadOnly
}
```

**Arquitectura**:
```
lib/supabase.ts          → cliente real (no cambia)
lib/supabase-readonly.ts → cliente con escrituras bloqueadas (nuevo)
hooks/useSupabase.ts     → hook que elige cuál devolver (nuevo)
```

**Ventajas**:
- Sin Proxy — código explícito y legible
- Más fácil de auditar que la Opción B
- Componentes nuevos quedan protegidos al usar el hook

**Desventajas**:
- El query builder de Supabase tiene ~30 métodos de filtrado que hay que replicar en el readonly
- Requiere migrar cada componente existente de `import { supabase }` a `useSupabase()`
- Los componentes no migrados quedan desprotegidos indefinidamente
- **Solo funciona dentro de componentes React** — no sirve en utilities, route handlers, o lógica fuera del árbol React
- No sirve en Server Components de Next.js

**Seguridad**: Solo UX

**Veredicto**: Mejor legibilidad que B pero más trabajo de implementación y limitación importante por ser hook.

---

### Opción A — RLS Minimalista con Supabase Auth ✅ RECOMENDADA

**Concepto**: Seguridad real a nivel de base de datos. RLS (Row Level Security) bloquea escrituras para usuarios anónimos. Admin se autentica silenciosamente al acceder a su URL, obteniendo un JWT que habilita las escrituras.

**Arquitectura**:
```
Admin URL /adminjms1320 → servidor sign in silencioso → JWT en cookie → BD permite writes
Ulises URL /ulises      → sin autenticación           → anon          → BD bloquea writes
```

**Flujo detallado**:

```
Admin browser  → supabase (con JWT en cookie) → BD (authenticated) → RLS permite writes
Ulises browser → supabase (sin JWT)           → BD (anon)          → RLS bloquea writes
```

#### Implementación concreta

**Paso 1 — Un usuario admin en Supabase Auth**
En el dashboard de Supabase, crear un usuario:
- Email: `admin@app.internal`
- Password: en variable de entorno `ADMIN_PASSWORD`

**Paso 2 — Sign in silencioso al acceder a la URL admin**

```typescript
// app/[accessRoute]/page.tsx
if (accessRoute === 'adminjms1320') {
  await supabaseServer.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  })
  // Supabase setea cookie con JWT automáticamente
}
```

**Paso 3 — RLS en la BD (aplicar a cada tabla)**

```sql
-- Lectura: todos pueden
CREATE POLICY "lectura_libre" ON tabla FOR SELECT USING (true);

-- Escritura: solo authenticated (admin)
CREATE POLICY "escritura_solo_admin" ON tabla
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "escritura_solo_admin" ON tabla
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "escritura_solo_admin" ON tabla
  FOR DELETE USING (auth.role() = 'authenticated');
```

**Paso 4 — Dependencia nueva**

```bash
npm install @supabase/ssr
```

El cliente pasa de `createClient` simple a uno que lee/escribe la cookie de sesión automáticamente.

#### Qué cambia y qué no cambia

| Componente | Cambia |
|-----------|--------|
| `lib/supabase.ts` | Sí — migrar a `@supabase/ssr` |
| `app/[accessRoute]/page.tsx` | Sí — sign in para admin |
| `middleware.ts` | Sí — nuevo, para refresh de sesión |
| Todos los componentes | **No cambia nada** |
| Todas las llamadas `supabase.from()` | **No cambia nada** |
| Lógica de negocio | **No cambia nada** |

#### Sesión y expiración

- **Access token**: expira en 1 hora (configurable)
- **Refresh token**: dura semanas, se renueva automáticamente en cada request via middleware
- Para el usuario es invisible — la sesión se mantiene activa
- Si el refresh token expira (default: 7 días sin actividad), volver a entrar a `/adminjms1320` re-autentica silenciosamente

#### Riesgos y consideraciones

1. **Migración del cliente Supabase**: el cliente actual no maneja cookies. Pasar a `@supabase/ssr` requiere dos versiones del cliente (servidor y browser). Bien documentado por Supabase para Next.js App Router.

2. **API routes existentes** (`/api/import-excel`, etc.): usan `service_role` key directamente — no cambian, siguen funcionando.

3. **Tablas en schemas distintos** (`msa.`, `ma.`, `pam.`): RLS se configura por tabla. Hay que aplicar políticas en cada tabla de cada schema. Es SQL repetitivo pero no complejidad conceptual.

4. **Activación de RLS en tablas con datos**: al activar RLS sin políticas, la tabla queda completamente bloqueada (ni lectura). Aplicar políticas de lectura ANTES de activar RLS, o dentro de una transacción.

**Seguridad**: **Real** — la `anon key` expuesta en browser no puede escribir aunque alguien lo intente desde DevTools o Postman.

---

## 4. COMPARATIVA FINAL

| Dimensión | B (Proxy) | C (Guard) | D (Hook) | **A (RLS)** |
|-----------|-----------|-----------|----------|-------------|
| Seguridad real | ❌ | ❌ | ❌ | ✅ |
| Protección automática features nuevas | ✅ frágil | ❌ | ✅ parcial | ✅ garantizada |
| Cambios en componentes | 0 | Muchos | Gradual | **0** |
| Cambios en lógica de negocio | 0 | 0 | 0 | **0** |
| Complejidad implementación | Alta | Baja | Alta | Media |
| Riesgo de romper algo | Alto | Bajo | Medio | Bajo-Medio |
| Debuggabilidad | Difícil | Fácil | Media | Fácil |
| Funciona fuera de componentes React | ✅ | ✅ | ❌ | ✅ |
| Hay que recordarlo en cada feature | No | **Sí** | Parcial | **No** |
| Trabajo estimado | 1-2 días | Horas | 1-2 días | Medio día |

---

## 5. DECISIÓN Y PRÓXIMOS PASOS

**Opción seleccionada**: A (RLS Minimalista) — pendiente de implementación

**Estado**: Documentado, no implementado aún

### Pasos para implementar cuando se decida avanzar

1. Instalar `@supabase/ssr`
2. Crear usuario admin en Supabase Auth dashboard
3. Agregar `ADMIN_EMAIL` y `ADMIN_PASSWORD` a variables de entorno (Vercel + `.env.local`)
4. Migrar `lib/supabase.ts` al cliente SSR
5. Crear `middleware.ts` para refresh automático de sesión
6. Modificar `app/[accessRoute]/page.tsx` para sign in silencioso del admin
7. Aplicar políticas RLS a todas las tablas (lectura libre + escritura solo authenticated)
8. Verificar que API routes existentes siguen funcionando (usan service_role, no se ven afectadas)
9. Testing: confirmar que Ulises no puede escribir y que admin sí puede

---

## 6. NOTAS ADICIONALES

### Agregar nuevos usuarios/roles

Hoy se hace en `config/access-routes.ts`. Con RLS implementado, el sistema de roles de la URL sigue igual para determinar qué tabs ve cada usuario. RLS agrega la capa de seguridad de escritura independientemente.

### Tercer código de acceso (consulta pura)

Discutido pero no implementado. Con RLS activo, cualquier URL que no sea admin automáticamente tiene acceso de solo lectura a nivel BD. Se puede agregar un tercer código (ej. `"consultor"`) en `access-routes.ts` que mapee a `readonly` y muestre todas las tabs — la protección de escritura ya estaría garantizada por RLS sin código adicional.

### Ulises — restricciones específicas dentro de Egresos

Las restricciones actuales (Vista de Pagos sin sección Pendiente, sin botón Revertir, etc.) están implementadas en `vista-facturas-arca.tsx` leyendo la URL directamente. Son restricciones de UX/visibilidad, independientes de RLS. Se mantienen igual después de implementar RLS.
