-- Deshace 100 · balance_datos_usuario (A-FEAT-1337).
--
-- Borra SÓLO lo que creó el 100, y lo comprueba en la base antes:
--   · la tabla tiene que llevar el comentario '[script 100]' (si no, no la creó el 100: se frena);
--   · tiene que estar VACÍA: si el usuario ya cargó datos, se frena — borrarla perdería su trabajo.
--     En ese caso, primero se decide con él qué hacer con esas filas.
--   · la fila de recurso_tablas se borra sólo si su motivo lleva la marca '[script 100]'.

begin;

do $$
declare n int;
begin
  if to_regclass('public.balance_datos_usuario') is null then
    raise notice 'public.balance_datos_usuario no existe: no hay nada que deshacer.';
    return;
  end if;
  if coalesce(obj_description('public.balance_datos_usuario'::regclass), '') not like '[script 100]%' then
    raise exception 'public.balance_datos_usuario no tiene la marca [script 100]: no la creó el 100. No se borra.';
  end if;
  select count(*) into n from public.balance_datos_usuario;
  if n > 0 then
    raise exception 'public.balance_datos_usuario tiene % fila(s) cargadas por el usuario: no se borra sin decidirlo con él.', n;
  end if;
  delete from public.recurso_tablas where tabla = 'balance_datos_usuario' and motivo like '[script 100]%';
  drop table public.balance_datos_usuario;
end $$;

commit;
notify pgrst, 'reload schema';
