-- Deshace el script 88 (A-FEAT-1296). ⚠️ Borra la tabla con los detalles fijos marcados: correr sólo si está vacía
-- o si se guardó antes lo que tenía.
begin;
delete from public.recurso_tablas where schema_nombre = 'public' and tabla = 'detalles_por_proveedor';
drop table if exists public.detalles_por_proveedor;
commit;
notify pgrst, 'reload schema';
