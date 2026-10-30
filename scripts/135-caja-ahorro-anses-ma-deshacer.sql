-- Deshace 135 · Caja de ahorro ANSES de MA (A-FEAT-1424).
--
-- Borra SÓLO lo que creó el 135, y lo comprueba en la base antes, tabla por tabla:
--   · tiene que llevar el comentario '[script 135]' (si no, no la creó el 135: se frena todo);
--   · tiene que estar VACÍA: si ya hay movimientos cargados, se frena — borrarla perdería el trabajo del usuario.
--   · la fila de recurso_tablas se borra sólo si su motivo lleva la marca '[script 135]'.

begin;

do $$
declare t text; n int;
begin
  foreach t in array array['ma.anses_ca_pesos'] loop
    if to_regclass(t) is null then
      raise notice '% no existe: nada que deshacer.', t;
      continue;
    end if;
    if coalesce(obj_description(to_regclass(t)), '') not like '[script 135]%' then
      raise exception '% no tiene la marca [script 135]: no la creó el 135. No se borra nada.', t;
    end if;
    execute format('select count(*) from %s', t) into n;
    if n > 0 then
      raise exception '% tiene % movimiento(s) cargados: no se borra sin decidirlo con JMS.', t, n;
    end if;
  end loop;

  foreach t in array array['ma.anses_ca_pesos'] loop
    if to_regclass(t) is not null then
      delete from public.recurso_tablas
        where schema_nombre = split_part(t, '.', 1) and tabla = split_part(t, '.', 2) and motivo like '[script 135]%';
      execute format('drop table %s', t);
    end if;
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';
