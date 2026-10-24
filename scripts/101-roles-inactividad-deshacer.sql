-- Deshace 101 · TIEMPO DE INACTIVIDAD POR ROL (A-FEAT-1351).
--
-- Borra SÓLO la columna que creó el 101, y lo comprueba en la base antes de borrar: tiene que existir
-- Y llevar el comentario '[script 101]'. Si no lo lleva, no es la del 101 y se frena sin borrar nada.
--
-- Al borrarla nadie pierde acceso: todos los roles vuelven al default (1 hora). Lo único que se pierde
-- es el tiempo distinto que se haya puesto a mano — el control de abajo lo muestra antes.

-- Control previo (sólo lee): los roles con un tiempo propio, que volverían a 1 hora.
select id, minutos_inactividad from public.roles where minutos_inactividad is not null;

begin;

do $$
declare
  comentario text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'roles' and column_name = 'minutos_inactividad'
  ) then
    raise notice 'public.roles.minutos_inactividad no existe: no hay nada que deshacer.';
    return;
  end if;

  select col_description('public.roles'::regclass, a.attnum) into comentario
  from pg_attribute a
  where a.attrelid = 'public.roles'::regclass and a.attname = 'minutos_inactividad' and not a.attisdropped;

  if comentario is null or position('[script 101]' in comentario) = 0 then
    raise exception 'public.roles.minutos_inactividad no tiene la marca [script 101]: no la creó el 101. No se borra.';
  end if;

  alter table public.roles drop column minutos_inactividad;
end $$;

commit;
