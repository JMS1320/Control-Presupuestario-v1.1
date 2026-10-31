-- Deshace 156 · borra SÓLO las columnas que creó el 156 (comentario '[script 156]') y SÓLO si siguen vacías
-- (null, o false en «revisado»). Si alguna ya tiene datos, se frena: eso es trabajo del usuario y se revisa a mano.

do $$
declare
  c record; con_datos bigint;
begin
  for c in
    select n.nspname as esquema, t.relname as tabla, a.attname as columna
      from pg_attribute a join pg_class t on t.oid = a.attrelid join pg_namespace n on n.oid = t.relnamespace
     where col_description(a.attrelid, a.attnum) = '[script 156]' and not a.attisdropped
  loop
    execute format('select count(*) from %I.%I where %I is not null and %I::text <> ''false''', c.esquema, c.tabla, c.columna, c.columna) into con_datos;
    if con_datos > 0 then
      raise exception '%.%.% ya tiene % fila(s) con datos: revisar a mano antes de deshacer.', c.esquema, c.tabla, c.columna, con_datos;
    end if;
  end loop;
  for c in
    select n.nspname as esquema, t.relname as tabla, a.attname as columna
      from pg_attribute a join pg_class t on t.oid = a.attrelid join pg_namespace n on n.oid = t.relnamespace
     where col_description(a.attrelid, a.attnum) = '[script 156]' and not a.attisdropped
  loop
    execute format('alter table %I.%I drop column %I', c.esquema, c.tabla, c.columna);
  end loop;
end $$;
