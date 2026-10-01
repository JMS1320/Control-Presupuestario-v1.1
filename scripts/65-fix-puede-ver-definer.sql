-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 65 · `puede_ver` necesitaba security definer        A-SEC-10 · 2026-09-24 · ROTURA EN VIVO
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- QUÉ ROMPIÓ
--   `scripts/63` reescribió `puede_ver` para que consultara `public.recurso_tablas`… y se olvidó
--   el `security definer`. Esa tabla está revocada a `authenticated` a propósito, así que **la
--   policy fallaba al leerla**:
--
--       403 · permission denied for table recurso_tablas
--
--   Resultado: **ningún usuario logueado podía leer casi ninguna tabla desde el navegador.** La
--   app parecía andar porque el menú y los contadores usan rutas con `service_role`, que saltea
--   la RLS — o sea que **la parte rota era justo la que no se ve al abrir la pantalla**.
--
-- ⚠️ POR QUÉ NO SE DETECTÓ ANTES — y esto vale más que el fix
--   `scripts/63` se verificó con `anon` (401, correcto) y con `service_role` (200, correcto).
--   **Ninguno de los dos pasa por esa policy**: `anon` no llega y `service_role` la saltea.
--   Se probaron los dos caminos que no podían fallar y no el único que importaba.
--   Apareció recién al consultar con el **JWT de un usuario real desde el navegador**.
--
--   📌 Regla que deja: una policy de RLS **sólo se prueba con una sesión de usuario**. Verificar
--   con `anon` y `service_role` da una falsa sensación de cobertura.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

create or replace function public.puede_ver(p_schema text, p_tabla text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select case
    when exists (select 1 from public.recurso_tablas rt
                 where rt.schema_nombre = p_schema and rt.tabla = p_tabla
                   and rt.restringe_lectura)
      then public.nivel_tabla(p_schema, p_tabla) in ('lectura', 'escritura')
    else coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> ''
  end
$fn$;

revoke all on function public.puede_ver(text, text) from public, anon;
grant execute on function public.puede_ver(text, text) to authenticated;

-- ── Control ──────────────────────────────────────────────────────────────────────────────────
-- NO se puede hacer desde el SQL Editor (ahí no hay JWT de usuario). Se hace desde el navegador,
-- logueado, consultando PostgREST con el access token de la sesión. Verificado el 2026-09-24:
-- 16 de 16 tablas en 200, y las 7 secciones trayendo datos reales.
