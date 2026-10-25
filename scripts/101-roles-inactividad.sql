-- 101 · CIERRE DE SESIÓN POR INACTIVIDAD — el tiempo de cada rol (A-FEAT-1351)
--
-- Usuario 2026-10-24: «cierre por inactividad a 1 hora sin actividad y configurable… si luego quiero
-- achicar o agrandar esa brecha». El cierre ya funciona SIN este script (1 hora para todos); el script
-- sólo agrega dónde guardar un tiempo distinto por rol, que se edita en Configuración → Roles.
--
-- QUÉ HACE: agrega a public.roles la columna `minutos_inactividad` (entero, VACÍA por default).
--   · Vacía = «el de siempre» (60 minutos, definido en lib/auth/inactividad.ts). Ningún rol cambia.
--   · Un check la limita a 5..1440 minutos (24 horas), lo mismo que valida la pantalla.
--   · No toca RLS, GRANTs, políticas ni el trigger roles_proteger_sistema (que sólo congela
--     secciones/2FA/id/es_sistema: el tiempo del admin SE PUEDE cambiar, a propósito).
--   · Ninguna vista lista public.roles.
--
-- 🛑 ANTES DE CORRER: aviso a Javier en ENTRE-DESARROLLADORES.md (roles = su territorio) y OK del
--    usuario. Lo corre T1, la única terminal que escribe en la base.
--
-- VERIFICADO EN LA BASE, por el propio script: si la columna ya existe, se frena SIN tocar nada. Si
-- termina, la columna la creó él, y el comentario '[script 101]' lo deja marcado para el deshacer.
--
-- Deshacer: 101-roles-inactividad-deshacer.sql

begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'roles' and column_name = 'minutos_inactividad'
  ) then
    raise exception 'public.roles.minutos_inactividad YA EXISTE: no se corre el 101. Avisar antes de seguir (no es de este script).';
  end if;
end $$;

alter table public.roles
  add column minutos_inactividad integer
  constraint roles_minutos_inactividad_rango check (minutos_inactividad between 5 and 1440);

comment on column public.roles.minutos_inactividad is
  '[script 101] A-FEAT-1351 — Minutos sin actividad antes de cerrar la sesión. NULL = el default (60, lib/auth/inactividad.ts). Se edita en Configuración → Roles.';

commit;

-- ── Control (sólo lee) ──────────────────────────────────────────────────────────────────────────
-- Tiene que devolver TODOS los roles con minutos_inactividad vacío: nadie cambió.
select id, minutos_inactividad from public.roles order by id;
