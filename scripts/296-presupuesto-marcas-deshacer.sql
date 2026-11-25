-- 296 DESHACER · la tabla la creó el 296 (no existía: CREATE TABLE sin IF NOT EXISTS). Sólo se borra si está vacía:
-- si JMS ya marcó renglones, se avisa y no se toca (son sus decisiones).
do $$
begin
  if (select count(*) from public.presupuesto_marcas) = 0 then
    drop table public.presupuesto_marcas;
    delete from public.recurso_tablas where schema_nombre = 'public' and tabla = 'presupuesto_marcas' and motivo like '[script 296]%';
  else
    raise notice 'presupuesto_marcas tiene marcas de JMS: no se borra.';
  end if;
end $$;
