-- Deshace 211 · borra la tabla de documentos de respaldo (la creó el 211, que frena si ya existía) y su fila en recurso_tablas.
-- ⚠️ Se pierden los vínculos cuenta + mes → archivo que se hayan cargado. Los archivos del Drive NO se tocan.
begin;
delete from public.recurso_tablas where schema_nombre = 'public' and tabla = 'documentos_respaldo' and motivo like '[script 211]%';
drop table public.documentos_respaldo;
commit;
notify pgrst, 'reload schema';
