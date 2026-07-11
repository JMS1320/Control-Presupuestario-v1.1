# 🎯 CLAUDE.md — Reglas y referencia del proyecto

> **Archivo magro a propósito**: solo reglas vinculantes + referencia crítica (se carga en cada sesión).
> El historial de sesiones (ago-2025 → 2026) vive en **`CLAUDE_HISTORICO.md`** (archivo, no se carga como regla).
> Pendientes → **`PENDIENTES.md`** · Arquitectura BD → **`ARQUITECTURA-BD.md`** · Conocimiento → **`KNOWLEDGE.md`**.

---

## 🤖 REGLAS AUTOMÁTICAS

### 💰 Convención Inputs Monetarios (es-AR) — OBLIGATORIO
Todo campo de texto donde el usuario ingrese un monto debe seguir este patrón:

```tsx
// Input
<Input type="text" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />

// Al guardar — parsear aceptando coma como decimal y punto como miles
parseFloat(String(valor).replace(/\./g, '').replace(',', '.')) || 0

// Al pre-cargar un valor numérico existente en el input
numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// 1234567.89 → "1.234.567,89"
```
- `type="text"` siempre (nunca `type="number"` para montos).
- Display en tabla: `numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- Filtros de monto: también `.replace(/\./g, '').replace(',', '.')` antes del `parseFloat`.

### 📚 Documentación — dónde va cada cosa (REGLA ABSOLUTA)
- **Arquitectura/estructura de BD** → SOLO `ARQUITECTURA-BD.md` (maestro) + `ESTRUCTURA_BD_COLUMNAS.md` (columnas). **NO crear otros archivos de arquitectura.**
- **Pendientes** → SOLO `PENDIENTES.md` (índice + dossiers con IDs). No desparramar TODOs.
- **ALTERs / cambios de BD no presentes en el backup** → además a `RECONSTRUCCION_SUPABASE_2026-01-07.md` (§ CAMBIOS POST-RECONSTRUCCIÓN).
- **Errores de build preexistentes** (no del cambio en curso) → `ERRORES_CONOCIDOS.md` (baseline).
- **Diseños de módulo** → `DISEÑO_*.md`, `CONCILIACION-CONTABILIDAD.md`, `VINCULACION-ANTICIPOS.md`, etc.
- **Conocimiento general** (funcionando / descartado / troubleshooting) → `KNOWLEDGE.md`.
- **Flujo de trabajo / cómo USA el usuario cada módulo (manual de uso)** → `MANUAL-USO.md`. NO es arquitectura (esa va en ARQUITECTURA-BD); es el "cómo se opera".

### 🗂️ Dimensiones de registro — cuando el usuario dice "registra" / "documenta"
No es un solo archivo: evaluar **TODAS** estas dimensiones y actualizar las que apliquen (varias suelen tocarse a la vez):
1. **Pendiente / bug / test** → `PENDIENTES.md` (índice + dossier).
2. **Cambio de BD** → `ARQUITECTURA-BD.md` / `ESTRUCTURA_BD_COLUMNAS.md` (+ `RECONSTRUCCION_*` si está fuera del backup).
3. **Flujo de trabajo / cómo se usa** → `MANUAL-USO.md`.
4. **Conocimiento general** → `KNOWLEDGE.md`.
5. **Continuidad entre sesiones** → memoria (`MEMORY.md` index).
6. **Error baseline** → `ERRORES_CONOCIDOS.md`.
Al terminar de registrar, decir explícitamente qué dimensiones se tocaron (para que el usuario controle que no quedó nada desparramado).

### 🛑 Datos — NUNCA modificar sin preguntar (REGLA ABSOLUTA)
- **Prohibido** hacer `UPDATE` / `INSERT` / `DELETE` sobre **datos reales** (valores de filas) sin **preguntar al usuario primero**. Incluye "valores de prueba", diagnósticos, revertir, etc.
- Aplica a la BD viva (MCP Supabase, SQL) y a cualquier dato del usuario. Para diagnosticar, **preguntar antes** y acordar qué tocar (o pedirle a él que lo haga desde la UI).
- Esto es distinto de los cambios de **estructura** (columnas/RPC/trigger acordados) — ver [[feedback_no_modificar_bd_sin_acuerdo]]: los de estructura también se avisan; los de **datos** se preguntan SÍ o SÍ.
- Motivo: el usuario perdió confianza cuando se le tocó un dato sin avisar; los datos son su fuente de verdad para testear.

### 🔧 Git
- **Pushear SIEMPRE a `desarrollo`** (nunca commitear directo a `main`). `main` = auto-deploy Vercel.
- Merge `desarrollo → main` solo cuando el usuario confirme testing OK.

---

## ⚡ Comandos de desarrollo
```bash
npm run dev                          # desarrollo
npm run build && npm run type-check  # build + tipos
npm test                             # tests
```

---

## 🔐 Accesos y roles
- Rutas-como-password (`config/access-routes.ts`): **`adminjms1320`** (admin, ve todo) · **`ulises`** (contable, solo Egresos: ARCA + Templates).
- Sin login real: es UX + validación de URL. **No protege la API** (ver A-SEC-01 en PENDIENTES — `anon` puede borrar todo).

---

## 📊 Datos críticos
- **Empresas / CUITs:** MSA `30617786016` · PAM `20044390222` · MA (schema `ma`).
- **Schemas BD:** `public`, `msa`, `pam`, `ma`, `productivo`, `sueldos`. Detalle → `ARQUITECTURA-BD.md`.
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Branches:** `main` (prod, auto-deploy Vercel) · `desarrollo` (trabajo). Testing por preview de Vercel.
- **MCP Supabase:** mantener en `--read-only`; pasar a write solo para cambios de BD acordados + revertir después (ver A-OP-01).

---

## 🧭 Navegación rápida
| Necesito… | Voy a… |
|-----------|--------|
| Qué falta / bugs / TODOs | `PENDIENTES.md` |
| Estructura de datos (tablas, columnas, permisos) | `ARQUITECTURA-BD.md` + `ESTRUCTURA_BD_COLUMNAS.md` |
| Cómo reconstruir la BD | `RECONSTRUCCION_SUPABASE_2026-01-07.md` |
| Conocimiento / configs / descartado | `KNOWLEDGE.md` |
| Cómo se USA la app / flujo de trabajo | `MANUAL-USO.md` |
| Historial de sesiones (referencia) | `CLAUDE_HISTORICO.md` |
| Contexto entre sesiones | memoria (`MEMORY.md` index) |
