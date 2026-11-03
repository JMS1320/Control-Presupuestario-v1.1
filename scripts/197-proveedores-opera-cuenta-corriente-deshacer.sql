-- ↩️ Deshacer del script 197. La columna NO existía antes del 197 (verificado el 03/11), así que borrarla sólo borra lo
-- que creó ese script: la marca de AFA y las que se hayan puesto después desde la ficha.
-- ⚠️ Si ya se marcaron otras contrapartes desde la ficha, se pierden: mirar antes
--     select cuit, razon_social from public.proveedores where opera_cuenta_corriente;
begin;
alter table public.proveedores drop column if exists opera_cuenta_corriente;
commit;
notify pgrst, 'reload schema';
