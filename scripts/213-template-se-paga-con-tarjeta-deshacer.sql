-- Deshacer del script 213: sólo lo que creó ese script (la columna y la función no existían: el 213 lo verifica antes).
drop trigger if exists cuota_nace_en_credito on public.cuotas_egresos_sin_factura;
drop function if exists public.cuota_nace_en_credito();
alter table public.egresos_sin_factura drop column if exists se_paga_con_tarjeta;
