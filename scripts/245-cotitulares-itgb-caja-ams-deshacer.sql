-- Deshace el 245: borra SÓLO lo que creó (ids fijos) y devuelve la extracción del Galicia MSA a como estaba (foto 245-foto-antes.json).
begin;
delete from msa.caja_ams where id in ('7a2c1e0e-245a-4c0b-9b1a-c07170002245', '7a2c1e0e-245a-4c0b-9b1a-c07170003245');
delete from public.cuotas_egresos_sin_factura where id = '7a2c1e0e-245a-4c0b-9b1a-c07170001245';
delete from public.egresos_sin_factura where id = '7a2c1e0e-245a-4c0b-9b1a-c07170000245'
  and not exists (select 1 from public.cuotas_egresos_sin_factura c where c.egreso_id = '7a2c1e0e-245a-4c0b-9b1a-c07170000245');
update public.msa_galicia set contable = 'CTA COTITULARES',
       nota_operador = nullif(regexp_replace(coalesce(nota_operador, ''), '( · )?↔ correspondencia: entra a la caja AMS.*\[script 245\]', ''), '')
 where id = 'abe11128-25b2-4442-a5ce-086894183e00';
commit;
