-- DESHACER del 109 · saca SÓLO las dos columnas que creó el 109 (verificadas por su marca) — y sólo si no hay mails
-- del subdiario guardados (borrar la columna perdería sus adjuntos).
begin;
do $$
begin
  if exists (select 1 from public.mails_pago where tipo = 'subdiario') then
    raise exception 'Hay mails del subdiario en la cola: no se borran las columnas. Avisar antes de seguir.';
  end if;
  if coalesce(col_description('public.mails_pago'::regclass, (select attnum from pg_attribute where attrelid = 'public.mails_pago'::regclass and attname = 'tipo')), '') not like '[script 109]%' then
    raise exception 'La columna tipo no tiene la marca del 109: no la creó este script.';
  end if;
end $$;
alter table public.mails_pago drop column if exists adjuntos;
alter table public.mails_pago drop column if exists tipo;
commit;
notify pgrst, 'reload schema';
