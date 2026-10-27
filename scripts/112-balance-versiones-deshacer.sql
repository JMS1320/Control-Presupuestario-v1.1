-- Deshace 112 · balance_versiones + balance_version_items (A-FEAT-1337 paso 2).
--
-- Borra SÓLO lo que creó el 112, y lo comprueba en la base antes:
--   · las dos tablas tienen que llevar el comentario '[script 112]' (si no, no las creó el 112: se frena);
--   · tienen que estar VACÍAS: si el usuario ya guardó o entregó versiones, se frena — borrarlas perdería lo
--     entregado, que es justo lo que no se puede perder. En ese caso, primero se decide con él.
--   · la función del trigger se borra sólo si lleva la marca '[script 112]';
--   · las filas de recurso_tablas se borran sólo si su motivo lleva la marca '[script 112]'.
begin;
do $$
declare n int;
begin
  if to_regclass('public.balance_versiones') is null and to_regclass('public.balance_version_items') is null then
    raise notice 'Las tablas del 112 no existen: no hay nada que deshacer.';
    return;
  end if;
  if coalesce(obj_description('public.balance_versiones'::regclass), '') not like '[script 112]%'
     or coalesce(obj_description('public.balance_version_items'::regclass), '') not like '[script 112]%' then
    raise exception 'Las tablas no tienen la marca [script 112]: no las creó el 112. No se borran.';
  end if;
  select count(*) into n from public.balance_versiones;
  if n > 0 then
    raise exception 'public.balance_versiones tiene % versión(es) guardadas por el usuario: no se borra sin decidirlo con él.', n;
  end if;
  select count(*) into n from public.balance_version_items;
  if n > 0 then
    raise exception 'public.balance_version_items tiene % ítem(s): no se borra sin decidirlo con el usuario.', n;
  end if;
  delete from public.recurso_tablas
    where tabla in ('balance_versiones', 'balance_version_items') and motivo like '[script 112]%';
  drop table public.balance_version_items;
  drop table public.balance_versiones;
  if coalesce(obj_description('public.balance_versiones_transicion()'::regprocedure), '') like '[script 112]%' then
    drop function public.balance_versiones_transicion();
  end if;
end $$;
commit;
notify pgrst, 'reload schema';
