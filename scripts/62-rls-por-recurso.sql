-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 62 · Que la RLS conozca la política de permisos        A-FEAT-169 etapa 5 · A-SEC-10 · 2026-09-24
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- QUÉ CIERRA
--   `scripts/57` puso RLS en ~95 tablas, pero su candado `tiene_rol()` sólo pregunta
--   «¿tenés ALGÚN rol?». O sea que hoy un `contable` pasa la misma puerta que un `admin`:
--   la política vive en `public.roles` y **la base no la lee**.
--
--   Esto la hace leer. Es lo único que convierte «sólo ver» en una barrera de verdad: apagar
--   botones en el navegador no impide nada (la sesión es la misma), y las **452 escrituras
--   directas desde el navegador** no pasan por ninguna ruta de API.
--
-- ⚠️ CÓMO SE CORRE: por PASOS, verificando entre uno y otro. El revert está al final.
--   El PASO 3 reemplaza las policies de todas las tablas: es el que puede dejar algo ilegible.
--
-- ⚠️ EL MAPEO ES LO DIFÍCIL, Y SE DECLARA — NO SE ADIVINA
--   Los permisos son por pestaña; la RLS es por tabla. Traducir mal no falla: **abre o rompe**.
--   Por eso el mapeo acepta DOS granularidades y se usa la más fina de la que haya certeza:
--     · `recurso` = una sección   (`'productivo'`)        → protege la sección entera
--     · `recurso` = una pestaña   (`'egresos.facturas-msa'`) → protege esa pestaña
--   Y **lo que no está mapeado conserva el comportamiento de hoy** (alcanza con tener rol). Un
--   hueco declarado se ve en la tabla; un mapeo equivocado no se ve en ningún lado.
-- ─────────────────────────────────────────────────────────────────────────────────────────────


-- ── PASO 1 · El mapeo tabla → recurso ────────────────────────────────────────────────────────
create table if not exists public.recurso_tablas (
  schema_nombre text not null,
  tabla         text not null,
  -- Id de `lib/auth/recursos.ts` ('egresos.facturas-msa') o de una sección ('productivo').
  recurso       text not null,
  motivo        text not null default '',
  primary key (schema_nombre, tabla)
);

comment on table public.recurso_tablas is
  'A-FEAT-169 etapa 5 — qué recurso gobierna cada tabla. Lo que no figura conserva el comportamiento anterior (basta tener rol). Se declara, no se adivina.';

alter table public.recurso_tablas enable row level security;
revoke all on public.recurso_tablas from anon, authenticated;

-- Semilla: SÓLO lo que es inequívoco.
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo) values
  -- A nivel de TABLA la ambigüedad por empresa desaparece: el schema ES la empresa.
  -- Esto no se podía hacer desde las rutas, donde una sola ruta toca las tres.
  ('msa', 'comprobantes_arca',       'egresos.facturas-msa', 'El schema es la empresa: inequívoco.'),
  ('pam', 'comprobantes_arca',       'egresos.facturas-pam', 'El schema es la empresa: inequívoco.'),
  ('ma',  'comprobantes_arca',       'egresos.facturas-ma',  'El schema es la empresa: inequívoco.'),
  ('msa', 'comprobantes_historico',  'egresos.facturas-msa', 'El histórico se ve en la misma pestaña.'),
  ('pam', 'comprobantes_historico',  'egresos.facturas-pam', 'El histórico se ve en la misma pestaña.')
on conflict (schema_nombre, tabla) do nothing;

-- Todo `productivo` a NIVEL SECCIÓN, no de pestaña.
-- ⚠️ A propósito: de sus 40 tablas sólo unas pocas se pueden atribuir a una pestaña con certeza
--    (¿`romaneos` es Hacienda o una venta? ¿`labores` es Órdenes o Lotes?). Mapear por sección
--    impide que un `contable` escriba en Productivo —que es el riesgo real— sin inventar nada.
--    Afinar a pestaña se hace después, fila por fila, cuando haya certeza.
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo)
select 'productivo', c.relname, 'productivo',
       'Sección: sus pestañas no se pueden atribuir con certeza tabla por tabla.'
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'productivo' and c.relkind = 'r'
on conflict (schema_nombre, tabla) do nothing;


-- ── PASO 2 · Las funciones que leen la política ──────────────────────────────────────────────
--
-- ⚠️ `security definer` es OBLIGATORIO acá y no es un descuido: `public.roles` está revocada a
--    `authenticated` a propósito (scripts/60), para que nadie pueda editarse sus permisos. Sin
--    `definer`, la policy no podría leer la tabla que define la policy.
--    Por eso se blindan las tres cosas que hacen peligroso un `definer`:
--      · `set search_path` fijo — si no, quien pueda crear objetos secuestra los nombres;
--      · `revoke ... from public` — el `EXECUTE` se otorga a PUBLIC por default, y revocárselo
--        sólo a `anon` NO lo cierra (comprobado el 2026-09-24 con `tiene_rol()`);
--      · no reciben nada del usuario salvo el nombre de tabla, y no arman SQL con eso.

create or replace function public.nivel_recurso(p_recurso text)
returns text
language sql stable security definer set search_path = public, pg_temp as $fn$
  -- El coalesce de afuera cubre el caso «el rol del JWT no existe en la tabla»: la subconsulta
  -- no devuelve fila y el resultado tiene que ser 'ninguno', nunca NULL — una policy que recibe
  -- NULL no concede, pero dejarlo implícito es pedir que alguien lo lea mal mañana.
  select coalesce(
    (select case
              -- Sin la sección no hay nada que discutir sobre el grano fino.
              when not (split_part(p_recurso, '.', 1) = any(ro.secciones)) then 'ninguno'
              -- Sin excepción declarada hereda de la sección = escritura: el default de siempre.
              else coalesce(ro.permisos ->> p_recurso, 'escritura')
            end
     from public.roles ro
     where ro.id = coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')),
    'ninguno')
$fn$;

create or replace function public.nivel_tabla(p_schema text, p_tabla text)
returns text
language sql stable security definer set search_path = public, pg_temp as $fn$
  select coalesce(
    (select public.nivel_recurso(rt.recurso)
     from public.recurso_tablas rt
     where rt.schema_nombre = p_schema and rt.tabla = p_tabla),
    -- Sin mapeo: el comportamiento anterior. Alcanza con tener rol.
    case when coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> ''
         then 'escritura' else 'ninguno' end
  )
$fn$;

create or replace function public.puede_ver(p_schema text, p_tabla text)
returns boolean language sql stable as $fn$
  select public.nivel_tabla(p_schema, p_tabla) in ('lectura', 'escritura')
$fn$;

create or replace function public.puede_escribir(p_schema text, p_tabla text)
returns boolean language sql stable as $fn$
  select public.nivel_tabla(p_schema, p_tabla) = 'escritura'
$fn$;

revoke all on function public.nivel_recurso(text)        from public, anon;
revoke all on function public.nivel_tabla(text, text)    from public, anon;
revoke all on function public.puede_ver(text, text)      from public, anon;
revoke all on function public.puede_escribir(text, text) from public, anon;
grant execute on function public.nivel_recurso(text)        to authenticated;
grant execute on function public.nivel_tabla(text, text)    to authenticated;
grant execute on function public.puede_ver(text, text)      to authenticated;
grant execute on function public.puede_escribir(text, text) to authenticated;

-- 🧮 CONTROL del PASO 2, antes de tocar ninguna policy.
-- Con tu sesión de admin las cuatro tienen que dar escritura/true:
--   select public.nivel_tabla('productivo','terneros'), public.puede_escribir('msa','comprobantes_arca');


-- ── PASO 3 · Las policies, ahora separando leer de escribir ──────────────────────────────────
-- Antes era UNA policy `FOR ALL`, que no distingue. Ahora van dos: si no se separan, «sólo
-- lectura» no existe — o entrás y escribís, o no entrás.
do $$
declare r record;
begin
  for r in
    select n.nspname as sch, c.relname as tab
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public','msa','pam','ma','productivo')
      and c.relkind = 'r'
      -- `public.roles` y el mapeo quedan afuera: se leen sólo con service_role (scripts/60).
      and not (n.nspname = 'public' and c.relname in ('roles', 'recurso_tablas'))
  loop
    execute format('drop policy if exists "solo_usuarios_habilitados" on %I.%I', r.sch, r.tab);
    execute format('drop policy if exists "ver_segun_permiso" on %I.%I', r.sch, r.tab);
    execute format('drop policy if exists "escribir_segun_permiso" on %I.%I', r.sch, r.tab);

    execute format(
      'create policy "ver_segun_permiso" on %I.%I
         for select to authenticated using (public.puede_ver(%L, %L))',
      r.sch, r.tab, r.sch, r.tab);

    execute format(
      'create policy "escribir_segun_permiso" on %I.%I
         for all to authenticated
         using (public.puede_escribir(%L, %L))
         with check (public.puede_escribir(%L, %L))',
      r.sch, r.tab, r.sch, r.tab, r.sch, r.tab);

    execute format('alter table %I.%I enable row level security', r.sch, r.tab);
  end loop;
end $$;


-- ── PASO 4 · VERIFICACIÓN (las tres tienen que dar CERO filas) ───────────────────────────────
select n.nspname, c.relname, 'sin RLS' as problema
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','msa','pam','ma','productivo')
  and c.relkind='r' and c.relrowsecurity = false
  and not (n.nspname='public' and c.relname in ('roles','recurso_tablas'));

select n.nspname, c.relname, 'le falta alguna policy' as problema
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','msa','pam','ma','productivo') and c.relkind='r'
  and not (n.nspname='public' and c.relname in ('roles','recurso_tablas'))
  and (select count(*) from pg_policies p
       where p.schemaname=n.nspname and p.tablename=c.relname
         and p.policyname in ('ver_segun_permiso','escribir_segun_permiso')) <> 2;

select schemaname, tablename, policyname, 'policy vieja' as problema
from pg_policies
where schemaname in ('public','msa','pam','ma','productivo')
  and policyname not in ('ver_segun_permiso','escribir_segun_permiso');


-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- REVERT — vuelve al estado de scripts/57 (candado `tiene_rol()`), no al de antes de la RLS.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- do $$
-- declare r record;
-- begin
--   for r in select n.nspname sch, c.relname tab from pg_class c
--            join pg_namespace n on n.oid=c.relnamespace
--            where n.nspname in ('public','msa','pam','ma','productivo') and c.relkind='r'
--              and not (n.nspname='public' and c.relname in ('roles','recurso_tablas')) loop
--     execute format('drop policy if exists "ver_segun_permiso" on %I.%I', r.sch, r.tab);
--     execute format('drop policy if exists "escribir_segun_permiso" on %I.%I', r.sch, r.tab);
--     execute format('create policy "solo_usuarios_habilitados" on %I.%I
--                       for all to authenticated
--                       using (public.tiene_rol()) with check (public.tiene_rol())', r.sch, r.tab);
--   end loop;
-- end $$;
-- drop function if exists public.puede_escribir(text, text);
-- drop function if exists public.puede_ver(text, text);
-- drop function if exists public.nivel_tabla(text, text);
-- drop function if exists public.nivel_recurso(text);
-- -- La tabla de mapeo se puede dejar: no hace nada sin las funciones.
