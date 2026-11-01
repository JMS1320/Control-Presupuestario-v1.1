-- Deshace 159 · borra la columna `imagen` de public.balance_pendientes SÓLO si la creó el 159 y sigue vacía.
do $$
begin
  if col_description('public.balance_pendientes'::regclass,
       (select ordinal_position from information_schema.columns where table_schema = 'public' and table_name = 'balance_pendientes' and column_name = 'imagen')::int)
     is distinct from '[script 159] Captura pegada en «Tu respuesta» del recorrido (data-URL comprimida).' then
    raise exception 'La columna imagen no es la del script 159: no se toca.';
  end if;
  if exists (select 1 from public.balance_pendientes where imagen is not null) then
    raise exception 'Hay respuestas con captura: revisar a mano antes de deshacer.';
  end if;
  alter table public.balance_pendientes drop column imagen;
end $$;
