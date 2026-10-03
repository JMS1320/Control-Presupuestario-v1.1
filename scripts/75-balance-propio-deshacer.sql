-- 🔙 Deshace scripts/75-balance-propio.sql. ⚠️ Borra las fotos cargadas: correr sólo con OK del usuario.
begin;
delete from public.recurso_tablas where schema_nombre = 'public' and tabla in ('balance_fotos', 'balance_foto_valores');
drop table if exists public.balance_foto_valores;
drop table if exists public.balance_fotos;
commit;
notify pgrst, 'reload schema';
