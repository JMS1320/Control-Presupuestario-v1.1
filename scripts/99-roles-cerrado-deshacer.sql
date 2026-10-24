-- Deshace 99 · ROL CERRADO (A-FEAT-1333).
--
-- Borra SÓLO la columna que creó el 99, y lo comprueba en la base antes de borrar: la columna tiene
-- que existir Y llevar el comentario '[script 99]'. Si no lo lleva, no es la del 99 (o alguien la
-- tocó) y el deshacer se frena sin borrar nada.
--
-- ⚠️ Antes de correrlo, mirar si algún rol quedó cerrado (el control de abajo). Al borrar la columna,
--    un rol cerrado vuelve a ABIERTO y su lista se lee al revés: lo que tenía tildado pasaría a ser
--    lo que se le saca. Primero se lo pasa a abierto desde Configuración → Roles (la pantalla convierte
--    la lista sin cambiar lo que ve) y recién después se corre esto.

-- Control previo (sólo lee): tiene que devolver 0 filas.
select id from public.roles where cerrado;

begin;

do $$
declare
  comentario text;
  cerrados int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'roles' and column_name = 'cerrado'
  ) then
    raise notice 'public.roles.cerrado no existe: no hay nada que deshacer.';
    return;
  end if;

  select col_description('public.roles'::regclass, a.attnum) into comentario
  from pg_attribute a
  where a.attrelid = 'public.roles'::regclass and a.attname = 'cerrado' and not a.attisdropped;

  if comentario is null or position('[script 99]' in comentario) = 0 then
    raise exception 'public.roles.cerrado no tiene la marca [script 99]: no la creó el 99. No se borra.';
  end if;

  select count(*) into cerrados from public.roles where cerrado;
  if cerrados > 0 then
    raise exception 'Hay % rol(es) cerrado(s): pasalos a abierto desde Configuración → Roles antes de deshacer.', cerrados;
  end if;

  alter table public.roles drop column cerrado;
end $$;

commit;
