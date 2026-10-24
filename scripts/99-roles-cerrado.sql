-- 99 · ROL CERRADO — lo nuevo nace apagado para el delegado (A-FEAT-1333, etapa 2 de A-FEAT-1322)
--
-- Usuario 2026-10-24, sobre Ulises: «no debe cambiar hasta darle click a la decisión de cambiar el
-- formato». Hoy un rol guarda en `permisos` lo que se le SACA, así que todo lo que se agregue a la app
-- le aparece solo. Con `cerrado = true` la misma lista dice lo que se le DA, y lo que se registre
-- después nace apagado. La lógica vive en lib/auth/rol-cerrado.ts.
--
-- QUÉ HACE: agrega una columna booleana a public.roles, falsa por default.
--   · Ningún rol existente cambia: todos quedan `cerrado = false` = abiertos, como hoy.
--   · El código ya está preparado para que la columna NO exista (lee sin ella), así que el orden
--     merge/script da igual.
--   · No toca RLS, GRANTs, políticas ni el trigger roles_proteger_sistema (un ADD COLUMN con default
--     constante no dispara triggers de fila). Ninguna vista lista public.roles.
--
-- 🛑 ANTES DE CORRER: aviso a Javier en ENTRE-DESARROLLADORES.md (roles = su territorio) y OK del
--    usuario. Lo corre T1, la única terminal que escribe en la base.
--
-- VERIFICADO EN LA BASE, por el propio script: si la columna ya existe, el script se frena SIN tocar
-- nada. Así, si llega a terminar, la columna la creó él — y el comentario '[script 99]' lo deja
-- marcado para que el deshacer pueda comprobarlo antes de borrar.
--
-- Deshacer: 99-roles-cerrado-deshacer.sql

begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'roles' and column_name = 'cerrado'
  ) then
    raise exception 'public.roles.cerrado YA EXISTE: no se corre el 99. Avisar antes de seguir (no es de este script).';
  end if;
end $$;

alter table public.roles add column cerrado boolean not null default false;

comment on column public.roles.cerrado is
  '[script 99] A-FEAT-1333 — Rol cerrado: `permisos` dice lo que se le DA y lo registrado después nace apagado. false = abierto (permisos = lo que se le saca). Lógica en lib/auth/rol-cerrado.ts.';

commit;

-- ── Control (sólo lee) ──────────────────────────────────────────────────────────────────────────
-- Tiene que devolver TODOS los roles con cerrado = false: nadie cambió de permisos.
select id, cerrado, secciones, permisos from public.roles order by id;
