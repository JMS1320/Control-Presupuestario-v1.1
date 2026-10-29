-- Deshace 131 · stock declarado al inicio + pasturas (A-FEAT-1420).
-- Borra SÓLO lo que creó el 131, comprobándolo en la base: la tabla tiene que llevar el comentario '[script 131]'.
-- Si tiene filas, frena: primero correr el deshacer del 132 (los datos) o decidirlo con JMS.
begin;
do $$
declare t text; n int;
begin
  foreach t in array array['productivo.stock_inicio','productivo.pasturas'] loop
    if to_regclass(t) is null then raise notice '% no existe: nada que deshacer.', t; continue; end if;
    if coalesce(obj_description(to_regclass(t)), '') not like '[script 131]%' then
      raise exception '% no tiene la marca [script 131]: no la creó el 131. No se borra nada.', t;
    end if;
    execute format('select count(*) from %s', t) into n;
    if n > 0 then raise exception '% tiene % fila(s): correr antes el deshacer del 132 o decidirlo con JMS.', t, n; end if;
  end loop;
  foreach t in array array['productivo.stock_inicio','productivo.pasturas'] loop
    if to_regclass(t) is not null then
      delete from public.recurso_tablas where schema_nombre = 'productivo' and tabla = split_part(t, '.', 2) and motivo like '[script 131]%';
      execute format('drop table %s', t);
    end if;
  end loop;
end $$;
commit;
notify pgrst, 'reload schema';
