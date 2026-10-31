-- Deshace 148 · borra la tabla de destinos del archivo digital (la creó el 148, que frena si ya existía).
-- ⚠️ Se pierden las carpetas elegidas: anotarlas antes si hay que volver a cargarlas. Los archivos del Drive NO se tocan.
begin;
delete from public.recurso_tablas where schema_nombre = 'public' and tabla = 'archivo_destinos' and motivo like '[script 148]%';
drop table public.archivo_destinos;
commit;
notify pgrst, 'reload schema';
