# USUARIOS — ARQUITECTURA DE ROLES Y ACCESO

> Documento de análisis y decisiones sobre el sistema de usuarios, roles y restricciones de escritura.
> **Fecha análisis**: 2026-04-16

---

## 0. ⚠️ CAMBIO DE RUMBO — 2026-09-03: login real en vez de sign-in silencioso

> **Leer esto ANTES que el resto del archivo.** Lo de abajo (secciones 1 a 6) es el análisis de
> abril-2026 y sigue siendo válido como comparativa, pero **la Opción A se implementó con una
> variante**, y en dos puntos dice lo contrario de lo que hoy hace el código.

**Decidido con el usuario el 2026-09-03.** Pidió *"una página de login que cumpla con OWASP y
estrictas medidas de seguridad para que no puedan hackear cuentas"*.

### Qué cambió respecto de la Opción A original

| | Opción A (abr-2026) | **Lo decidido (2026-09-03)** |
|---|---|---|
| Cómo entra el admin | **sign-in silencioso** al abrir `/adminjms1320`, con `ADMIN_EMAIL`/`ADMIN_PASSWORD` en variables de entorno | **página de login** con email y contraseña propios |
| Cuentas | **una compartida** por rol | **individuales por persona** |
| Rutas-como-password | conviven (siguen dando el rol) | **reemplazo total** — la URL ya no da acceso |
| Segundo factor | no contemplado | **TOTP obligatorio para `admin`**, opcional para `contable` |
| Permisos de `anon` | **lectura libre**, escritura sólo `authenticated` | **`anon` sin nada** |

### Por qué se cambió (los motivos, para poder priorizar después)

1. **Cuentas individuales** son la única forma de tener **audit log por usuario**
   ([A-SEC-01](PENDIENTES.md#a-sec-01) P2·11) y de **revocarle el acceso a una sola persona**. Con
   una credencial compartida no se sabe nunca quién hizo cada cambio.
2. Habilita la **quinta pieza del norte administrativo — el PERMISO** (`CLAUDE.md`): que Ulises
   pueda cargar el resumen de la tarjeta ([A-AUTO-01](PENDIENTES.md#a-auto-01)) sin que la tarea
   vuelva a JMS. Delegar exige poder dar acceso fino a una persona concreta.
3. **`anon` sin permisos** (y no "lectura libre") porque, si **todos** se loguean, `anon` ya no
   tiene ningún uso legítimo. El propio dossier A-SEC-01 dice que *cerrar `anon` es lo que mueve la
   aguja*: la `anon_key` viaja en el bundle JS por diseño, así que mientras tenga SELECT cualquiera
   se lleva **los montos y CUITs de toda la operación** con un `curl`. Dejarle lectura era mitigar;
   revocarle todo es cerrar.
4. **Sign-in silencioso con la clave en una env var** significa que quien vea el entorno (o un
   dump de build) entra como admin, y que la clave es la misma para siempre. Un login real la deja
   en manos de cada persona y permite rotarla.

### Decisiones técnicas que valen como regla

- **El rol vive en `app_metadata.role` del JWT, NUNCA en `user_metadata`.** `user_metadata` lo
  puede escribir el propio usuario con su sesión (`auth.updateUser`): guardar el rol ahí es
  regalar un escalado de privilegios. `app_metadata` sólo se escribe con `service_role`.
- **Para autorizar se usa `auth.getUser()`, nunca `getSession()`.** `getSession()` devuelve lo que
  dice la cookie sin validarla contra el servidor de Auth.
- **`lib/supabase.ts` pasó a `createBrowserClient`** (`@supabase/ssr`): la sesión viaja en
  **cookies** y no en localStorage. Es lo que hace que las ~103 pantallas que importan ese cliente
  queden autenticadas **sin tocarles una línea** — con el cliente viejo mandarían `anon` y la RLS
  las frenaría a todas.

### Estado real al 2026-09-03 — código hecho, nada testeado, BD sin tocar

**✅ Hecho (rama `feature/login`, sin commitear, build OK):**
- `middleware.ts` — refresco de sesión, corte de acceso y cabeceras de seguridad (CSP,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
- `/login` + `app/login/actions.ts` — mensaje **único** ante credenciales inválidas (no permite
  enumerar usuarios) y validación del `volver_a` (no permite redirección abierta).
- `/login/2fa` (desafío) y `/login/2fa/alta` (alta del TOTP con QR). El middleware **no deja
  entrar al admin sin `aal2`**.
- `/auth/signout` — sólo **POST**, para que un `<img src>` no pueda desloguear (CSRF de logout).
- `app/page.tsx` — la app vive en la raíz y el rol sale de la sesión. Sin rol → `/no-access`.
- `app/[accessRoute]/page.tsx` — las rutas viejas **redirigen a `/`**; ya no dan acceso. No se
  borró la ruta para que los favoritos no den 404.
- **6 lecturas del rol desde `window.location`** en `vista-facturas-arca.tsx` pasadas al prop de
  sesión. ⚠️ Sin esto el admin habría perdido sus permisos **en silencio** al desaparecer la
  ruta-password. `grep adminjms1320` sobre ese archivo da **cero**.
- `notas-para-claude.tsx` — el rol sale de la sesión y la ruta se guarda entera (ya no hay llave
  que recortar). Ver [A-SEC-04](PENDIENTES.md#a-sec-04).

### 👥 Alta de cuentas desde la app (2026-09-03)

Pedido del usuario: *"quiero poder crear cuentas desde el usuario con rol de administrador"* — sin
depender del dashboard de Supabase.

**`/usuarios`** (sólo admin): lista de cuentas con rol, estado de 2FA, último ingreso; alta de
cuentas; cambio de rol; y revocación.

**Decisiones y por qué:**
- **No se define contraseña en el alta.** Se usa `admin.generateLink({type:'invite'})`, que crea la
  cuenta y devuelve un **link de un solo uso**; la persona elige su clave. Motivo: ningún admin
  conoce la clave de otro, y no hay una contraseña viajando por la UI ni por los logs. Además
  **no depende de que haya SMTP configurado** — el link se copia y se pasa por donde se quiera.
  Si algún día se configura SMTP, se cambia a envío automático sin tocar nada más.
- **Revocar NO borra: bloquea** (`ban_duration`). Borrar la cuenta rompería la trazabilidad de
  quién hizo qué, y `CLAUDE.md` prohíbe lo destructivo por default. Es reversible.
- **Candado anti-encierro:** no se puede cambiar el rol ni revocarse **a uno mismo**. Sin esto, el
  último admin podía bajarse a `contable` y dejar el sistema sin nadie que pueda volver a entrar a
  esta pantalla — irrecuperable desde la app.
- **La API se defiende sola** (`lib/auth/guard-admin.ts`): exige sesión + rol `admin` + **`aal2`**.
  Lo de `aal2` importa: sin eso, robar una cookie de sesión alcanzaría para **crear cuentas
  nuevas**, que es la escalada más grave posible. No se confía sólo en el middleware — es
  [A-SEC-06](PENDIENTES.md#a-sec-06) aplicado a los endpoints más peligrosos.
- **El middleware ahora devuelve `401` JSON en `/api/*`** en vez de redirigir al login.

**🥚 Huevo y gallina — la PRIMERA cuenta:** el panel exige ser admin con 2FA, así que el primer
admin **no puede crearse desde ahí**. Se crea en el dashboard de Supabase y se le pone el rol con
`scripts/58`. De ahí en más, todas las demás salen del panel.

**🚪 Salir:** se agregó `BarraSesion` arriba de las pestañas (email + rol + link a Usuarios si sos
admin + botón Salir). Antes no había cómo cerrar sesión porque no había sesión.

**🔴 Falta (todo lo que toca la BD o depende de cuentas):**
1. Crear las cuentas en Supabase (Authentication → Users). **Las contraseñas las pone cada
   persona**; Claude no crea cuentas ni tipea credenciales.
2. Habilitar en Supabase Auth: **MFA TOTP**, **protección de contraseñas filtradas (HIBP)** y
   largo mínimo de contraseña.
3. Correr `scripts/57-rls-login-cerrar-anon.sql` — revoca todo a `anon` y pone RLS real.
   **Paso a paso**, con la foto previa y el revert listo, como pide el protocolo de A-SEC-01.
4. Correr `scripts/58-asignar-roles-usuarios.sql` — asigna el rol. **Toca datos**: se pregunta.
5. **Testear todo** → [A-TEST-81](PENDIENTES.md#a-sec-03).

**⚠️ Lo que este cambio NO resuelve:**
- El **CSP lleva `unsafe-inline`/`unsafe-eval`** porque Next inyecta su bootstrap inline →
  [A-SEC-05](PENDIENTES.md#a-sec-05).
- Las **29 API routes usan `service_role`**, o sea que **saltean RLS por diseño**. Hoy su única
  defensa es el middleware → [A-SEC-06](PENDIENTES.md#a-sec-06).

### ⚙️ Preferencias personales — dónde viven y qué NO puede entrar ahí (2026-09-05, A-FEAT-83)

Cada usuario configura cosas de su propia cuenta desde `/perfil`: en qué sección lo abre la app, si
el menú arranca abierto, si quiere los contadores de pendientes, si le pregunta antes de salir, y
si quiere ver las explicaciones de las pantallas (A-FEAT-84 — el criterio de qué se puede apagar
está en `KNOWLEDGE.md` § `data-ayuda`, porque es transversal a todo el sistema).

**Por qué las explicaciones son preferencia de usuario y no configuración de la app**: es el caso
Ulises, o sea la § quinta pieza (el PERMISO) aplicada a otra cosa. Él es nuevo y necesita la letra
chica; JMS hizo el sistema y le sobra. Un interruptor global significaría que el que sabe se la
apaga **también al que está aprendiendo** — y el que está aprendiendo es justamente el que hace que
la tarea se pueda delegar.

**Dónde**: `user_metadata.preferencias`, un objeto, junto al nombre y la foto. Lo lee
`lib/auth/preferencias.ts` y lo escribe el propio usuario con `auth.updateUser()`.

**Por qué ahí y no en una tabla.** Son datos **de una persona, sobre su propia pantalla**: no los
consulta nadie más, no entran en ningún reporte y no hay que cruzarlos con nada. Una tabla nueva
pediría RLS, endpoint y migración para guardar cuatro banderitas que ya viajan en el JWT que la
sesión trae igual.

⚠️ **Y acá está la contracara, que es la parte que hay que respetar:** `user_metadata` **lo edita
el propio dueño de la cuenta** — es el mismo motivo por el que el rol vive en `app_metadata` (§
Decisiones técnicas). Entonces:

> **Ninguna preferencia puede decidir un permiso.** Lo que se elige acá **no agranda lo que se ve,
> sólo lo acomoda.**

El caso concreto es la *sección de inicio*: se guarda un id de sección en un lugar que el usuario
escribe a mano. Si esa preferencia decidiera qué se muestra, un `contable` se pondría
`seccionInicio: "sueldos"` con un `updateUser` y entraría a Sueldos. **No decide**: se valida
igual contra las secciones permitidas del rol (`dashboard.tsx`), y una que no corresponde cae al
default. Es la misma puerta que ya cerró A-FEAT-82 para el `?seccion=` de la URL — la preferencia
entra por la misma validación, no por un atajo.

**Lectura tolerante, a propósito**: `leerPreferencias()` valida campo por campo y el que no cierra
cae a su default, en vez de romper la pantalla. Es un JSON libre que el usuario puede escribir con
cualquier contenido, y además una preferencia vieja puede haber quedado con otro tipo después de un
cambio del código.

### 🖼️ La foto de perfil: el link se descarga, no se guarda como link (2026-09-05, A-FEAT-83)

`/api/perfil/avatar` acepta **un archivo o una URL**, y las dos terminan igual: la imagen guardada
en nuestro Storage, en `<user.id>/avatar`.

**Un link ajeno no se puede guardar como link**, aunque parezca lo más simple: el CSP de
`middleware.ts` sólo permite imágenes de `'self'` y de Supabase, así que el navegador lo bloquea
**en silencio** — la URL responde 200, el perfil se guarda bien, y el avatar muestra las iniciales
como si nunca hubieras cargado nada. Es el mismo modo de falla que ya había costado una sesión con
las fotos de Storage. Descargarla, además, la vuelve nuestra: no se rompe el día que el otro sitio
la borra y no le cuenta a ese sitio quién mira la app.

⚠️ **Descargar una URL que elige el usuario es una puerta al SSRF**: el que la pega elige a qué
dirección se conecta **el servidor**, no su navegador. `lib/red/traer-imagen-remota.ts` la cierra —
sólo http/https, **resuelve el nombre antes de conectarse** y rechaza IPs internas (loopback,
privadas, CGNAT y sobre todo `169.254.169.254`, el metadata service del hosting), sigue las
redirecciones **de a una revalidando cada salto**, y corta por timeout y por tamaño (el
`content-length` declarado *y* los bytes que llegan de verdad).

### 🐞 Corregido de paso: el bug que este archivo daba por abierto
La sección 1 decía que **`VistaEgresos` no recibe el prop `userRole`**. **Ya estaba arreglado**
(la firma lo recibe y lo baja a `VistaFacturasArca`); lo que seguía vivo era la lectura del rol
desde la URL, que es lo que se corrigió ahora.

---

## 1. ESTADO ACTUAL DEL SISTEMA (abril-2026 — ver § 0)

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

**Opción seleccionada**: A (RLS Minimalista).

**Estado (2026-09-03)**: implementada **con la variante del § 0** (login real en vez de sign-in
silencioso, cuentas individuales, `anon` sin permisos). Los 9 pasos de abajo quedan como
referencia; el estado real y lo que falta están en el **§ 0**.

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
