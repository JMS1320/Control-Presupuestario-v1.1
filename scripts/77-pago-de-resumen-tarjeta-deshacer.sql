-- 🔙 Deshace scripts/77-pago-de-resumen-tarjeta.sql. ⚠️ Pierde los vínculos pago ↔ resumen ya hechos.
begin;
alter table public.msa_galicia    drop column if exists nro_resumen;
alter table public.pam_galicia    drop column if exists nro_resumen;
alter table public.pam_galicia_cc drop column if exists nro_resumen;
alter table ma.ma_galicia         drop column if exists nro_resumen;
commit;
notify pgrst, 'reload schema';
