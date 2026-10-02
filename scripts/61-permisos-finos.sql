-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 61 · Permisos finos: excepciones dentro de una sección          A-FEAT-169 · 2026-09-24
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- `roles.secciones` reparte por solapa entera. Esto agrega el grano fino: poder sacarle a un rol
-- UNA pestaña o UNA funcionalidad sin sacarle la sección.
--
-- DECISIONES, con su motivo:
--
--   · La columna guarda **sólo las excepciones**, no el permiso completo.
--     `{}` = "todo lo que hay dentro de las secciones que tenés". Que es exactamente cómo funciona
--     hoy, así que **no hace falta migrar ni una fila**: el día 1 nadie cambia de permisos.
--     La alternativa —listar todos los recursos permitidos— obligaba a mantener dos fuentes de
--     verdad (`secciones` y la lista) y a migrarlas juntas para siempre. Con excepciones,
--     `secciones` sigue siendo la única fuente de lo grueso y esta columna sólo le resta.
--
--   · Forma: `{"<recurso>": "<nivel>"}`, con el id tal como lo declara `lib/auth/recursos.ts`
--     (`"extracto.auditoria"`, `"productivo.insumos"`).
--
--   · Niveles que existen HOY: sólo **`"ninguno"`** (no se ve). `"lectura"` llega en la etapa 3,
--     **junto con el código que la aplica**. ⚠️ No se agrega antes a propósito: es la misma
--     decisión que tomó `scripts/60` — «una columna de permisos que ninguna guarda chequea parece
--     un permiso y no lo es», que es peor que no tenerla.
--
-- Idempotente y NO destructivo: `add column if not exists`, y no toca ninguna fila.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

alter table public.roles
  add column if not exists permisos jsonb not null default '{}'::jsonb;

comment on column public.roles.permisos is
  'A-FEAT-169 — EXCEPCIONES dentro de las secciones que da `secciones`. Forma {"<recurso>":"<nivel>"} con los ids de lib/auth/recursos.ts. Vacío = todo lo de adentro. Hoy el único nivel es "ninguno".';

-- Que no entren niveles inventados: una clave con un valor que nadie interpreta se comporta como
-- "sin excepción" y el permiso queda abierto sin que nadie lo note.
--
-- ⚠️ Va por función y no con un `not exists (...)` adentro del CHECK: **Postgres no admite
--    subconsultas en un CHECK** («cannot use subquery in check constraint»). Una función
--    `immutable` sí está permitida, y además deja el criterio en un solo lugar.
create or replace function public.roles_permisos_validos(p jsonb) returns boolean
language sql immutable as $fn$
  -- `bool_and` sobre cero filas devuelve NULL, y `{}` tiene que ser válido: de ahí el coalesce.
  select coalesce(bool_and(v in ('ninguno', 'lectura', 'escritura')), true)
  from jsonb_each_text(p) as e(k, v)
$fn$;

alter table public.roles drop constraint if exists roles_permisos_niveles;
alter table public.roles add constraint roles_permisos_niveles
  check (public.roles_permisos_validos(permisos));

-- ── Control ──────────────────────────────────────────────────────────────────────────────────
-- Tiene que devolver 2 filas, las dos con permisos = {} (nadie cambia de permisos hoy).
select id, secciones, permisos, es_sistema from public.roles order by id;

-- ── REVERT ───────────────────────────────────────────────────────────────────────────────────
-- alter table public.roles drop constraint if exists roles_permisos_niveles;
-- alter table public.roles drop column if exists permisos;
-- drop function if exists public.roles_permisos_validos(jsonb);
