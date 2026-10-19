-- Deshace el 80. ⚠️ Borra los pendientes anotados.
delete from public.recurso_tablas where schema_nombre = 'public' and tabla = 'balance_pendientes';
drop table if exists public.balance_pendientes;
notify pgrst, 'reload schema';
