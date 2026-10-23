-- Deshace el script 91 (A-FEAT-1312). El monto en pesos de la cuota queda como estaba (no se toca);
-- se pierde sólo el registro del original en USD y del cambio.
begin;
alter table public.cuotas_egresos_sin_factura drop column if exists monto_usd, drop column if exists tipo_cambio;
commit;
notify pgrst, 'reload schema';
