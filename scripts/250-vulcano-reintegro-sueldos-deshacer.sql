-- Deshace el 250: todo a la foto (250-foto-antes.json); borra SÓLO el pago que creó (id fijo).
begin;
update public.msa_galicia set sueldo_pago_id = '8fd083cf-7c4e-447b-8e99-7d0d8672f00d', template_cuota_id = 'd056f415-20f1-4a0d-aae0-203c93701c54',
  categ = 'GASTOS VARIOS GANADERIA', contable = 'CTA MA', interno = '', nota_operador = null
 where id = '48f5813b-7e7e-4fda-ae85-d55f9dee4eee' and nota_operador like '%[script 250]';
delete from sueldos.pagos where id = '7a2c1e0e-250a-4c0b-9b1a-c07170000250';
update sueldos.periodos set varios = 0, bruto_calculado = bruto_calculado - 84000, observaciones = null
 where id = 'ee33a972-3541-4aa2-beb1-81be25bee30d' and observaciones like '%[script 250]';
update public.cuotas_egresos_sin_factura set estado = 'conciliado', descripcion = null
 where id = 'd056f415-20f1-4a0d-aae0-203c93701c54' and descripcion like '%[script 250]';
commit;
