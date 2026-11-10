-- Deshace el 238 (por id; la cuenta sólo si la creó el 238 y nadie la usa).
begin;
update msa.caja_sigot set template_cuota_id=null, template_id=null, estado='pendiente', categ=null, nro_cuenta=null, centro_de_costo=null, contable=null, interno=null
  where id in ('a2293466-7ce5-491a-b9c8-2d839b869a14','d456e858-e717-4fc0-bf73-13c5c72c16a2');
update public.cuotas_egresos_sin_factura set categ='REPUESTOS Y REPARACIONES', centro_costo=null, descripcion=null
  where id in ('10033407-a616-4d12-b8ba-31d56b06cc7e','88e3ffe7-8275-461d-96bb-7ea84e499d47');
delete from public.cuentas_contables where nro_cuenta='422141' and cambio_nombre_cta='creada 09-11 [script 238]'
  and not exists (select 1 from public.cuotas_egresos_sin_factura where categ='MANTENIMIENTO EDILICIO')
  and not exists (select 1 from public.egresos_sin_factura where categ='MANTENIMIENTO EDILICIO');
commit;
