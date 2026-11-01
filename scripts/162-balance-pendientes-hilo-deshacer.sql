-- Deshace 162 · borra la columna `hilo` de public.balance_pendientes SÓLO si la creó el 162 y sigue vacía.
do $$
begin
  if col_description('public.balance_pendientes'::regclass,
       (select ordinal_position from information_schema.columns where table_schema = 'public' and table_name = 'balance_pendientes' and column_name = 'hilo')::int)
     not like '[script 162]%' then
    raise exception 'La columna hilo no es la del script 162: no se toca.';
  end if;
  if exists (select 1 from public.balance_pendientes where hilo is not null) then
    raise exception 'Hay temas con mensajes en el hilo: revisar a mano antes de deshacer.';
  end if;
  alter table public.balance_pendientes drop column hilo;
end $$;
