-- Deshacer del script 145: saca las columnas `ventas` y `totales_ventas` de public.ddjj_presentadas.
-- Seguro: verifica la marca [script 145] de cada columna antes de borrarla (el 145 se niega a correr si ya existían).
-- ⚠️ Se pierden las ventas declaradas que se hayan guardado ahí (lo de compras no se toca). Se recargan con el 146.
begin;
do $$ declare c text; begin
  foreach c in array array['ventas', 'totales_ventas'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ddjj_presentadas' and column_name = c)
       and coalesce(col_description('public.ddjj_presentadas'::regclass,
             (select attnum from pg_attribute where attrelid = 'public.ddjj_presentadas'::regclass and attname = c)), '') not like '[script 145]%' then
      raise exception 'public.ddjj_presentadas.% existe pero NO tiene la marca [script 145]: no la creó este script. No se borra.', c;
    end if;
  end loop;
end $$;
alter table public.ddjj_presentadas drop column if exists ventas;
alter table public.ddjj_presentadas drop column if exists totales_ventas;
commit;
notify pgrst, 'reload schema';
