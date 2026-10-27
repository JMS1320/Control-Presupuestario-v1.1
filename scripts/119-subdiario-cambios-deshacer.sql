-- ↩️ Deshacer del script 119 — saca SÓLO lo que creó el 119 (verifica su marca antes de borrar).
begin;
do $$
declare t text;
begin
  if to_regclass('public.subdiario_cambios') is not null
     and coalesce(obj_description('public.subdiario_cambios'::regclass), '') not like '[script 119]%' then
    raise exception 'public.subdiario_cambios existe pero NO tiene la marca [script 119]: no la creó este script. No se borra.';
  end if;
  foreach t in array array['msa.comprobantes_arca', 'pam.comprobantes_arca', 'ma.comprobantes_arca',
                           'msa.comprobantes_venta', 'pam.comprobantes_venta', 'ma.comprobantes_venta'] loop
    if to_regclass(t) is not null then
      execute format('drop trigger if exists trg_registrar_cambio_subdiario on %s', t);
    end if;
  end loop;
  if to_regprocedure('public.registrar_cambio_subdiario()') is not null
     and coalesce(obj_description('public.registrar_cambio_subdiario()'::regprocedure), '') like '[script 119]%' then
    drop function public.registrar_cambio_subdiario();
  end if;
end $$;
delete from public.recurso_tablas where tabla = 'subdiario_cambios' and motivo like '[script 119]%';
drop table if exists public.subdiario_cambios;
commit;
notify pgrst, 'reload schema';
