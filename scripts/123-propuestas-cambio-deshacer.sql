-- ↩️ Deshacer del script 123 (A-FEAT-1400). Borra la tabla public.propuestas_cambio, que el 123 creó nueva (frena
-- si ya existía). Las facturas no se tocan: lo aceptado ya está aplicado en ellas; lo pendiente se pierde.
begin;
drop table if exists public.propuestas_cambio;
commit;
