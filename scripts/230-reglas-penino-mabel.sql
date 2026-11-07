-- 230 · ACOMPAÑA AL 229 (DATOS) — A-FEAT-1577, OK de JMS 07/11: «adaptá primero y corré todo junto. penino ok, mabel como empleada».
--
-- A · REGLAS POR TEMPLATE (`reglas_contable_interno`): las que al conciliar escribían los códigos viejos pasan a los nuevos, para que la
--     próxima conciliación ya escriba lo acordado. Sólo `codigo_contable`; el interno no se toca.
--       RET 3 MA → CTA MA (7) · RET 3 PAM → CTA PAM (4) · Desglosar → vacío en la Visa Business de MSA (2)
--       · «Tarjeta VISA PAM» pagada desde Galicia MSA: Desglosar → CTA PAM (MSA paga la tarjeta de PAM = PAM retira; JMS 07/11, C2).
-- B · PENINO: la extracción de MSA del 24/04/2026 ($ 1.000.000, «1 Millón justo para pagar a Pintor») deja de ir a CAJA y queda pagando
--     la factura de Penino a MA del 23/04 ($ 1.000.000) — retiro de MA (CTA MA lo pone el 229). Su cuota del template «Caja» se creó sólo
--     para esa extracción: se borra, y el deshacer la vuelve a crear idéntica (foto completa abajo, en el deshacer).
-- C · MABEL (Rojas Celia Mabel, CUIT 27-20361536-7, doméstica de PAM): como empleada de PAM en Sueldos, igual que Alondra en MA y
--     con el mismo armado que los históricos (scripts 163 y 222): un período por mes con lo pagado, y cada pago del banco vinculado.
--       31/07/25 $ 429.000 (CA PAM) → jul · 01/09/25 $ 360.000 (CA PAM) → ago · 30/09/25 $ 380.000 (CC PAM) → sep
--       · 09/10/25 $ 219.892 (CC PAM, «Mabel Liq Final») → oct, liquidación final. El detalle de cada movimiento NO se toca.
--     Los 2 pagos de junio 2025 (otra destinataria, fuera del ejercicio) no se tocan.
-- Marca: «[script 230]». Deshacer: 230-reglas-penino-mabel-deshacer.sql.

begin;

-- ── A · reglas
update reglas_contable_interno set codigo_contable = 'CTA MA'  where codigo_contable = 'RET 3 MA' and id in
  ('2ab7af5d-7997-4cef-aa2f-19528f844d96','864a22d5-1125-4c5a-b244-5e22b78b3d94','290ee74d-e8ea-488a-aa2f-a8f99274813e','01af622f-4a01-41bc-b130-c07981bdf826',
   '5432ae16-3692-447f-a65c-a9924fb746a6','473c8bba-5523-4c11-9087-2b17f9c42d8d','cdf87950-5520-425a-b925-67c070a42b2b');
update reglas_contable_interno set codigo_contable = 'CTA PAM' where codigo_contable = 'RET 3 PAM' and id in
  ('c507672f-a6b3-4d7b-91a5-85700ab98c90','77ad0114-cc17-4666-8e4c-4ad9c35066cd','438b9c9c-d26d-4afa-9830-9691a14061a0','4a50ca82-eb0d-4d5d-b410-f83406eda568');
update reglas_contable_interno set codigo_contable = null      where codigo_contable = 'Desglosar' and id in
  ('d76dce97-29ee-4624-8677-596c025e598d','e5409492-556c-417b-8159-06fa4deddb69');
update reglas_contable_interno set codigo_contable = 'CTA PAM' where codigo_contable = 'Desglosar' and id = '979f2e94-a2b2-4091-ae0e-bc5a1b329ce5';

-- ── B · Penino
update public.msa_galicia
   set template_cuota_id = null, comprobante_arca_id = 'b97ca33a-caa9-4082-ab56-6ac4c6f58c78',
       categ = 'Pintura, materiales y herramientas', proveedor_nombre = 'PENINO MIGUEL GUSTAVO',
       comprobantes_pagados = 'Factura de Penino a MA del 23/04/2026 ($ 1.000.000) — en efectivo, no pasó por caja [script 230]'
 where id = '19e5f9f2-db6e-4974-a7ed-09fb1787abf8' and template_cuota_id = 'ee8efdba-a308-4825-8003-9a41e59fca86' and comprobante_arca_id is null;
delete from cuotas_egresos_sin_factura c
 where c.id = 'ee8efdba-a308-4825-8003-9a41e59fca86'
   and not exists (select 1 from public.msa_galicia m where m.template_cuota_id = c.id);

-- ── C · Mabel
insert into sueldos.empleados (id, nombre, tipo_empleado, empresa, cuit_empleado, francos_dias_promedio, dias_promedio, horas_promedio, activo, fecha_ingreso, fecha_egreso)
select 'e23c12c2-45ff-4a58-a414-fe29006c546c', 'Rojas Celia Mabel', 'plano_ipc', 'PAM', '27-20361536-7', 0, 0, 0, false, null, '2025-10-09'
where not exists (select 1 from sueldos.empleados where replace(cuit_empleado, '-', '') = '27203615367');

insert into sueldos.periodos (id, empleado_id, campana_id, anio, mes, fecha_inicio_periodo, fecha_fin_periodo,
  monto_a, monto_b, bruto_calculado, sueldo_x_ipc, anticipos_descontados, saldo_pendiente, estado, observaciones)
select x.id::uuid, 'e23c12c2-45ff-4a58-a414-fe29006c546c', '8ffb3f4f-6dc7-4df1-88de-09607518d2c1', 2025, x.mes, x.ini::date, x.fin::date,
  x.monto, 0, x.monto, 0, x.monto, 0, 'historico', x.obs
from (values
  ('d9d9fab9-db1b-4489-842c-8b4613e23306', 7,  '2025-07-01', '2025-07-31', 429000::numeric, 'Histórico: armado con lo pagado (CA PAM 31/07/2025, «Sueldo Dom NZ - Mabel») [script 230]'),
  ('39e46191-f30d-4b2d-8c79-c3e7573eb6b9', 8,  '2025-08-01', '2025-08-31', 360000::numeric, 'Histórico: armado con lo pagado (CA PAM 01/09/2025, «Sueldo Dom NZ») [script 230]'),
  ('6332e152-f19a-4797-877b-42f1194a5bf4', 9,  '2025-09-01', '2025-09-30', 380000::numeric, 'Histórico: armado con lo pagado (CC PAM 30/09/2025, «Sueldo Mabel») [script 230]'),
  ('fedb44d6-58ce-4770-91e2-e97ff721d799', 10, '2025-10-01', '2025-10-31', 219892::numeric, 'Liquidación final (CC PAM 09/10/2025, «Mabel Liq Final») [script 230]')
) as x(id, mes, ini, fin, monto, obs)
where exists (select 1 from sueldos.empleados where id = 'e23c12c2-45ff-4a58-a414-fe29006c546c');

insert into sueldos.pagos (id, periodo_id, empleado_id, tipo, fecha, monto, estado, medio_pago, descripcion, visible_contable)
select x.id::uuid, x.periodo::uuid, 'e23c12c2-45ff-4a58-a414-fe29006c546c', 'sueldo', x.fecha::date, x.monto, 'conciliado', 'banco', x.descr, false
from (values
  ('17811a33-bed8-4c7b-bbf8-cb0ff1d17760', 'd9d9fab9-db1b-4489-842c-8b4613e23306', '2025-07-31', 429000::numeric, 'Sueldo jul 2025 — CA PAM 31/07/2025 [script 230]'),
  ('4ce9a395-2e1b-4b0a-8ffd-6063756fad7b', '39e46191-f30d-4b2d-8c79-c3e7573eb6b9', '2025-09-01', 360000::numeric, 'Sueldo ago 2025 — CA PAM 01/09/2025 [script 230]'),
  ('b42f9f5a-5fe0-46c6-ae76-72bff1fec174', '6332e152-f19a-4797-877b-42f1194a5bf4', '2025-09-30', 380000::numeric, 'Sueldo sep 2025 — CC PAM 30/09/2025 [script 230]'),
  ('8f50ec6f-777b-4f3e-8ae7-016c46148672', 'fedb44d6-58ce-4770-91e2-e97ff721d799', '2025-10-09', 219892::numeric, 'Liquidación final — CC PAM 09/10/2025 [script 230]')
) as x(id, periodo, fecha, monto, descr)
where exists (select 1 from sueldos.periodos p where p.id = x.periodo::uuid);

update public.pam_galicia set sueldo_pago_id = '17811a33-bed8-4c7b-bbf8-cb0ff1d17760', estado = 'conciliado', categ = 'Sueldos', proveedor_nombre = 'Rojas Celia Mabel'
 where id = 'e58074a8-0280-44d7-ae11-e0414ca58c4b' and sueldo_pago_id is null and debitos = 429000 and exists (select 1 from sueldos.pagos where id = '17811a33-bed8-4c7b-bbf8-cb0ff1d17760');
update public.pam_galicia set sueldo_pago_id = '4ce9a395-2e1b-4b0a-8ffd-6063756fad7b', estado = 'conciliado', categ = 'Sueldos', proveedor_nombre = 'Rojas Celia Mabel'
 where id = '27b090fb-cb03-470c-9294-13188f4e5e6b' and sueldo_pago_id is null and debitos = 360000 and exists (select 1 from sueldos.pagos where id = '4ce9a395-2e1b-4b0a-8ffd-6063756fad7b');
update public.pam_galicia_cc set sueldo_pago_id = 'b42f9f5a-5fe0-46c6-ae76-72bff1fec174', estado = 'conciliado', categ = 'Sueldos', proveedor_nombre = 'Rojas Celia Mabel'
 where id = 'edb144a1-f51b-41a8-a922-c837787e1346' and sueldo_pago_id is null and debitos = 380000 and exists (select 1 from sueldos.pagos where id = 'b42f9f5a-5fe0-46c6-ae76-72bff1fec174');
update public.pam_galicia_cc set sueldo_pago_id = '8f50ec6f-777b-4f3e-8ae7-016c46148672', estado = 'conciliado', categ = 'Sueldos', proveedor_nombre = 'Rojas Celia Mabel'
 where id = 'c3db32f4-4e2b-4526-b5b6-afc02f5408fe' and sueldo_pago_id is null and debitos = 219892 and exists (select 1 from sueldos.pagos where id = '8f50ec6f-777b-4f3e-8ae7-016c46148672');

commit;

-- Control
select (select count(*) from reglas_contable_interno where activo and codigo_contable in ('RET 3 MA','RET 3 PAM','Desglosar')) reglas_viejas_que_quedan,
       (select count(*) from public.msa_galicia where id = '19e5f9f2-db6e-4974-a7ed-09fb1787abf8' and comprobante_arca_id = 'b97ca33a-caa9-4082-ab56-6ac4c6f58c78' and template_cuota_id is null) penino,
       (select count(*) from cuotas_egresos_sin_factura where id = 'ee8efdba-a308-4825-8003-9a41e59fca86') cuota_caja_que_queda,
       (select count(*) from sueldos.pagos where empleado_id = 'e23c12c2-45ff-4a58-a414-fe29006c546c') pagos_mabel,
       (select count(*) from public.pam_galicia where sueldo_pago_id in ('17811a33-bed8-4c7b-bbf8-cb0ff1d17760','4ce9a395-2e1b-4b0a-8ffd-6063756fad7b'))
     + (select count(*) from public.pam_galicia_cc where sueldo_pago_id in ('b42f9f5a-5fe0-46c6-ae76-72bff1fec174','8f50ec6f-777b-4f3e-8ae7-016c46148672')) movimientos_mabel;
