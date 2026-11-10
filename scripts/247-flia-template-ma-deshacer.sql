-- Deshace el 247: devuelve movimientos y cuotas a la foto (247-foto-antes.json) y borra SÓLO el template y la categoría que creó (ids fijos).
begin;
update ma.ma_galicia m set contable = f.contable, template_id = f.template_id, nota_operador = f.nota_operador
  from (values ('8665e46b-c8cc-4dcc-a5df-e4262b1f6207'::uuid, '[script 181] JMS 02/11 (Excel CA MA): «Consumo»'),
               ('f8667d39-8dae-4839-b4cf-4736ff1d32e9'::uuid, '[script 181] JMS 02/11 (Excel CA MA): «consumo»'),
               ('107f8211-36d6-4268-80da-bfd4f3acbc56'::uuid, '[script 181] JMS 02/11 (Excel CA MA): «consumo»'),
               ('c41313bb-93eb-4703-9b21-e00f03ebe6a9'::uuid, '[script 181] JMS 02/11 (Excel CA MA): «Consumo»'))
       as v(id, nota), lateral (select 'FLIA'::text contable, '79c4229e-288c-40a1-98a0-da24482b3eeb'::uuid template_id, v.nota nota_operador) f
 where m.id = v.id and m.nota_operador like '%[script 247]%';
update public.cuotas_egresos_sin_factura set egreso_id = '79c4229e-288c-40a1-98a0-da24482b3eeb', detalle = replace(detalle, 'FLIA — ', 'Consumos MA — '), descripcion = null
 where id in ('07e1d564-d5bd-41ce-86a0-79701e61b721','4c8356fa-4506-4b6d-83b3-b0459f42429a','6403b7ba-a49c-4372-8b77-4c34eb3704b6','74a682d2-96bb-466e-a0d2-f88ab09751e0')
   and descripcion like '%[script 247]%';
delete from public.egresos_sin_factura where id = '7a2c1e0e-247a-4c0b-9b1a-c07170000247'
  and not exists (select 1 from public.cuotas_egresos_sin_factura c where c.egreso_id = '7a2c1e0e-247a-4c0b-9b1a-c07170000247');
delete from public.cuentas_contables where id = '7a2c1e0e-247b-4c0b-9b1a-c07170000247';
commit;
