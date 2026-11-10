-- 247 · P4 de «Propuestas para aprobar» (OK de JMS 10/11: «sí, acá sería template FLIA, entra y sale… flia no va a ninguna cuenta corriente;
-- es la categoría del egreso o ingreso y no implica contable ni interno»; «es algo de MA… no tiene que ir en ningún lugar en particular»).
-- 1) categoría FLIA en el plan (tipo NO: no se presupuesta ni va a un rubro) · 2) template FLIA de MA, bidireccional, sin código
-- 3) las 4 cuotas de Consumos MA (José María → MA $ 2.001.000 · MA → Andrés $ 325.000) pasan a FLIA · 4) los movimientos quedan sin código.
-- Foto: 247-foto-antes.json. Deshacer: 247-flia-template-ma-deshacer.sql
begin;
insert into public.cuentas_contables (id, categ, cuenta_contable, tipo, activo, imputable)
select '7a2c1e0e-247b-4c0b-9b1a-c07170000247', 'FLIA', 'FLIA', 'NO', true, true
where not exists (select 1 from public.cuentas_contables where categ = 'FLIA');
insert into public.egresos_sin_factura (id, nombre_referencia, categ, responsable, tipo, es_bidireccional, tipo_recurrencia, tipo_template, periodicidad,
  aplica_generacion, activo, actualizacion_proximas_cuotas, pago_anual, cuenta_agrupadora, observaciones_template)
values ('7a2c1e0e-247a-4c0b-9b1a-c07170000247', 'FLIA', 'FLIA', 'MA', 'NO', true, 'abierto', 'abierto', 'anual', false, true, 'false', false, 'FLIA',
  '[script 247] movimientos de MA con la familia (entra y sale). Sin código contable ni interno salvo que se diga lo contrario (JMS 10/11)');
update public.cuotas_egresos_sin_factura set egreso_id = '7a2c1e0e-247a-4c0b-9b1a-c07170000247', detalle = replace(detalle, 'Consumos MA — ', 'FLIA — '),
  descripcion = concat_ws(' · ', nullif(descripcion, ''), 'era Consumos MA [script 247]')
 where id in ('07e1d564-d5bd-41ce-86a0-79701e61b721','4c8356fa-4506-4b6d-83b3-b0459f42429a','6403b7ba-a49c-4372-8b77-4c34eb3704b6','74a682d2-96bb-466e-a0d2-f88ab09751e0')
   and egreso_id = '79c4229e-288c-40a1-98a0-da24482b3eeb';
update ma.ma_galicia set contable = null, template_id = '7a2c1e0e-247a-4c0b-9b1a-c07170000247',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'template FLIA, sin código (era contable FLIA en Consumos MA) [script 247]')
 where id in ('8665e46b-c8cc-4dcc-a5df-e4262b1f6207','f8667d39-8dae-4839-b4cf-4736ff1d32e9','107f8211-36d6-4268-80da-bfd4f3acbc56','c41313bb-93eb-4703-9b21-e00f03ebe6a9')
   and contable = 'FLIA';
commit;
