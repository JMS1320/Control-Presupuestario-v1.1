-- 250 · P5 (OK de JMS 10/11: «a Vulcano hay que ponerle un concepto de esto del tema médico de 84, con lo cual tendría 84 a cobrar. De ahí se le
-- vincula la transferencia y ahí se netea» · «está bien lo que proponés»). La transferencia del Galicia MSA del 06/04/26 ($ 84.000 a Marcela
-- Sandra Amestoy, «Reintegro Vulcano Gastos Medicos») estaba (a) en Otros Gastos con CTA MA y (b) vinculada POR ERROR al pago de sueldo de
-- Alondra Olivo (que ya tiene su transferencia del 08/04). Foto: 250-foto-antes.json. Deshacer: 250-…-deshacer.sql
begin;
-- 1) Vulcano, abril 2026: «Varios» $ 84.000 a cobrar (el bruto suma los varios)
update sueldos.periodos set varios = 84000, bruto_calculado = bruto_calculado + 84000,
  observaciones = concat_ws(' · ', nullif(observaciones, ''), 'Varios $ 84.000 = reintegro gastos médicos, pagado por transferencia del 06/04/26 [script 250]')
 where id = 'ee33a972-3541-4aa2-beb1-81be25bee30d' and coalesce(varios, 0) = 0;
-- 2) el pago que lo netea (saldo del mes: 1.844.000 − 84.000 = 1.760.000, que es lo que ya decía)
insert into sueldos.pagos (id, periodo_id, empleado_id, tipo, fecha, monto, descripcion, estado, medio_pago, visible_contable)
values ('7a2c1e0e-250a-4c0b-9b1a-c07170000250', 'ee33a972-3541-4aa2-beb1-81be25bee30d', '5f957469-2316-4274-bc88-88961ba2c39a', 'sueldo', '2026-04-06', 84000,
  'Reintegro gastos médicos [script 250]', 'conciliado', 'banco', false);
-- 3) la transferencia: va a Sueldos (pago de Vulcano), sale de Otros Gastos, sin CTA MA
update public.msa_galicia set sueldo_pago_id = '7a2c1e0e-250a-4c0b-9b1a-c07170000250', template_cuota_id = null, categ = 'Sueldos', contable = null, interno = null,
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'reintegro gastos médicos a Fabián Vulcano: pago de Sueldos (estaba vinculado por error al pago de Alondra Olivo y en Otros Gastos con CTA MA) [script 250]')
 where id = '48f5813b-7e7e-4fda-ae85-d55f9dee4eee' and sueldo_pago_id = '8fd083cf-7c4e-447b-8e99-7d0d8672f00d';
-- 4) la cuota de Otros Gastos queda desactivada (no se borra)
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = concat_ws(' · ', nullif(descripcion, ''), 'pasó a Sueldos: reintegro a Vulcano [script 250]')
 where id = 'd056f415-20f1-4a0d-aae0-203c93701c54' and estado = 'conciliado';
commit;
