-- Deshace el 230 (sólo lo que creó o cambió él; cada paso exige encontrar lo que dejó el 230).
begin;

-- C · Mabel: los movimientos vuelven a como estaban (histórico, sin categoría ni proveedor, sin vínculo); se borran pagos, períodos y empleada
update public.pam_galicia set sueldo_pago_id = null, estado = 'historico', categ = null, proveedor_nombre = null
 where id in ('e58074a8-0280-44d7-ae11-e0414ca58c4b','27b090fb-cb03-470c-9294-13188f4e5e6b')
   and sueldo_pago_id in ('17811a33-bed8-4c7b-bbf8-cb0ff1d17760','4ce9a395-2e1b-4b0a-8ffd-6063756fad7b');
update public.pam_galicia_cc set sueldo_pago_id = null, estado = 'historico', categ = null, proveedor_nombre = null
 where id in ('edb144a1-f51b-41a8-a922-c837787e1346','c3db32f4-4e2b-4526-b5b6-afc02f5408fe')
   and sueldo_pago_id in ('b42f9f5a-5fe0-46c6-ae76-72bff1fec174','8f50ec6f-777b-4f3e-8ae7-016c46148672');
delete from sueldos.pagos where empleado_id = 'e23c12c2-45ff-4a58-a414-fe29006c546c' and descripcion like '%[script 230]%';
delete from sueldos.periodos where empleado_id = 'e23c12c2-45ff-4a58-a414-fe29006c546c' and observaciones like '%[script 230]%';
delete from sueldos.empleados e where e.id = 'e23c12c2-45ff-4a58-a414-fe29006c546c'
   and not exists (select 1 from sueldos.periodos p where p.empleado_id = e.id) and not exists (select 1 from sueldos.pagos g where g.empleado_id = e.id);

-- B · Penino: vuelve la cuota «Caja» idéntica (foto del 07/11) y la extracción vuelve a pagarla, como CAJA
insert into cuotas_egresos_sin_factura
select * from json_populate_record(null::cuotas_egresos_sin_factura,
  '{"id":"ee8efdba-a308-4825-8003-9a41e59fca86","egreso_id":"5767ce58-807d-4c47-a91f-1dc7fc53e699","numero_cuota":null,"fecha_vencimiento":"2026-04-24","fecha_estimada":"2026-04-24","monto":1000000.00,"estado":"conciliado","descripcion":null,"detalle":"Extraccion para Distribucion MA. 1 Millon Justo para pagar a Pintor","cuenta_contable":null,"centro_costo":null,"created_at":"2026-04-23T18:38:12.494047+00:00","updated_at":"2026-04-23T18:38:12.494047+00:00","mes":null,"tipo_movimiento":"egreso","grupo_pago_id":null,"medio_pago":"banco","categ":null,"visible_contable":false,"fecha_pago":null,"monto_usd":null,"tipo_cambio":null}')
where not exists (select 1 from cuotas_egresos_sin_factura where id = 'ee8efdba-a308-4825-8003-9a41e59fca86');
update public.msa_galicia
   set template_cuota_id = 'ee8efdba-a308-4825-8003-9a41e59fca86', comprobante_arca_id = null, categ = 'CAJA', proveedor_nombre = 'Martinez Sobrado Agro SRL',
       comprobantes_pagados = 'Caja MSA - Abril 2026'
 where id = '19e5f9f2-db6e-4974-a7ed-09fb1787abf8' and comprobante_arca_id = 'b97ca33a-caa9-4082-ab56-6ac4c6f58c78';

-- A · reglas: cada una vuelve a su código anterior
update reglas_contable_interno set codigo_contable = 'RET 3 MA' where codigo_contable = 'CTA MA' and id in
  ('2ab7af5d-7997-4cef-aa2f-19528f844d96','864a22d5-1125-4c5a-b244-5e22b78b3d94','290ee74d-e8ea-488a-aa2f-a8f99274813e','01af622f-4a01-41bc-b130-c07981bdf826',
   '5432ae16-3692-447f-a65c-a9924fb746a6','473c8bba-5523-4c11-9087-2b17f9c42d8d','cdf87950-5520-425a-b925-67c070a42b2b');
update reglas_contable_interno set codigo_contable = 'RET 3 PAM' where codigo_contable = 'CTA PAM' and id in
  ('c507672f-a6b3-4d7b-91a5-85700ab98c90','77ad0114-cc17-4666-8e4c-4ad9c35066cd','438b9c9c-d26d-4afa-9830-9691a14061a0','4a50ca82-eb0d-4d5d-b410-f83406eda568');
update reglas_contable_interno set codigo_contable = 'Desglosar' where codigo_contable is null and id in
  ('d76dce97-29ee-4624-8677-596c025e598d','e5409492-556c-417b-8159-06fa4deddb69');
update reglas_contable_interno set codigo_contable = 'Desglosar' where codigo_contable = 'CTA PAM' and id = '979f2e94-a2b2-4091-ae0e-bc5a1b329ce5';

commit;
