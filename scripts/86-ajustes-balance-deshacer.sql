-- Deshace el script 86 (A-FEAT-1207 versión chica). ⚠️ Borra la tabla con sus ajustes: correr sólo si está vacía
-- o si se guardó antes lo que tenía.
begin;
delete from public.recurso_tablas where schema_nombre = 'public' and tabla = 'ajustes_balance';
drop table if exists public.ajustes_balance;
commit;
notify pgrst, 'reload schema';
