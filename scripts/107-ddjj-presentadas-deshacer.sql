-- DESHACER del 107 · borra SÓLO lo que creó el 107 (verificado por su marca antes de borrar).
begin;
do $$
begin
  if to_regclass('public.ddjj_presentadas') is null then
    raise notice 'public.ddjj_presentadas no existe: nada que deshacer.';
  elsif coalesce(obj_description('public.ddjj_presentadas'::regclass), '') not like '[script 107]%' then
    raise exception 'public.ddjj_presentadas existe pero NO tiene la marca [script 107]: no la creó este script. No se borra.';
  end if;
end $$;
delete from public.recurso_tablas where tabla = 'ddjj_presentadas' and motivo like '[script 107]%';
drop table if exists public.ddjj_presentadas;
commit;
notify pgrst, 'reload schema';
