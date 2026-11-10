-- 259 · D2 y D3 de «Decisiones P2» (OK de JMS 10/11).
-- D2: el pago del 12/01/26 «SICORE» ($ 1.351.504,60, VEP 1571030450) — JMS: «es un pago de enero del 26, que en mi detalle es Sicore, así que lo
--     podemos poner como un Sicore». Va a la cuota de SICORE de enero (2da quincena, 09/01/26, estaba en $ 0) con su importe. Las otras quincenas
--     en $ 0 no se tocan («no hay nada que hacer aquí… es parte de lo que igual el contador tiene»).
-- D3: las 6 transferencias del 08/01/26 a proveedores «ret de ganancias no declarada» — JMS: «no haría templates, esto no es un template. Esto se
--     pagó a estos proveedores… que esté conciliado el pago y punto, se le pone una explicación». Pasan a «conciliado» SIN vínculo (conciliación
--     de excepción) con la explicación en la nota. No se toca el «detalle» ni la categoría.
-- Foto: 259-foto-antes.json. Deshacer: 259-…-deshacer.sql.
begin;
update public.cuotas_egresos_sin_factura set monto = 1351504.60, descripcion = 'pago de SICORE de enero-26 (Galicia MSA CC 12/01/26, VEP 1571030450; JMS: «le podemos poner Sicore») [script 259]'
 where id = 'fcce0466-0168-4fe2-b8aa-1067274949e6' and monto = 0 and estado = 'conciliado';
update public.msa_galicia set template_id = '2f0f8552-74ef-496a-9dbf-92ff97f6aca1', template_cuota_id = 'fcce0466-0168-4fe2-b8aa-1067274949e6', categ = 'Retenciones ARCA',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'vinculado a SICORE de enero-26 (2da quincena, cuota del 09/01/26) [script 259]')
 where id = 'b5ebe508-dc7c-4ed6-a86a-affe6a0f7a0f' and template_cuota_id is null;
update public.msa_galicia set estado = 'conciliado',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), '✔ CONCILIADO POR EXCEPCIÓN (JMS 10/11): devolución al proveedor de la retención de Ganancias de una liquidación vieja que finalmente no se declaró — es un pago al proveedor, sin factura nueva ni template [script 259]')
 where id in ('c472c3f5-5011-4c9c-92eb-8b10f110ae45', 'f70e5994-a67e-4fdd-b25e-efc1e08ff20b', 'd6ab924b-4d1d-4db7-889d-3c8613da8d16', '1da54875-0c2e-4203-8da3-14c0838dbeb4',
              '2a4276b4-8711-4924-9b8c-5ea8b0fa72d6', '32a827e9-989c-46b3-9878-7d35c4e244f6') and estado = 'historico';
commit;
