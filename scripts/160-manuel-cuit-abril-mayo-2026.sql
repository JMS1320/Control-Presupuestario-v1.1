-- 160 · MANUEL MARTÍNEZ: SU CUIT Y SUS SUELDOS DE ABRIL Y MAYO 2026 (DATOS) — OK de JMS 01/11 («3 adelante. 4 también»)
--
-- Qué hace:
--  (1) sueldos.empleados: CUIT de Manuel = 24-24754471-9 (el que informa el banco; en Sueldos estaba vacío).
--  (2) sueldos.periodos: abril y mayo 2026 (campaña 25/26), por hora como sus meses de 2025:
--        abril: 10 h × $ 24.862,33 + $ 24.000 de gastos = $ 272.623,30 → se pagó $ 272.623 (redondeo 0,30 anotado)
--        mayo:   6 h × $ 25.708    + $ 30.000 de gastos = $ 184.248 exacto
--  (3) sueldos.pagos: un pago de sueldo por mes (banco, conciliado).
--  (4) public.msa_galicia: los dos movimientos (08/05/2026 $ 272.623 y 05/06/2026 $ 184.248) conciliados contra esos pagos,
--      CATEG Sueldos (como su pago de diciembre).
-- Marca: observaciones/descripcion con «[script 160]». Deshacer: 160-…-deshacer.sql (por ids).

update sueldos.empleados set cuit_empleado = '24-24754471-9'
 where id = 'cc7272c6-50ec-4ba9-a535-047b2a6f8227' and cuit_empleado is null;

insert into sueldos.periodos (id, empleado_id, campana_id, anio, mes, estado, horas_mes, valor_por_hora, varios, monto_a, monto_b,
  bruto_calculado, anticipos_descontados, saldo_pendiente, sueldo_x_ipc, fecha_inicio_periodo, fecha_fin_periodo, observaciones) values
 ('0ef58eb7-0a17-43d7-9a2c-9ee89a06238e', 'cc7272c6-50ec-4ba9-a535-047b2a6f8227', '8ffb3f4f-6dc7-4df1-88de-09607518d2c1', 2026, 4, 'proyectado',
  10, 24862.33, 24000, 272623, 0, 272623, 272623, 0, 0, '2026-04-01', '2026-04-30',
  'Por hora, eventual: 10 h × $ 24.862,33 + $ 24.000 de gastos = $ 272.623,30; se pagó $ 272.623 (redondeo 0,30) [script 160]'),
 ('4c3124bd-16a6-40e6-b9a9-07e1a1192daa', 'cc7272c6-50ec-4ba9-a535-047b2a6f8227', '8ffb3f4f-6dc7-4df1-88de-09607518d2c1', 2026, 5, 'proyectado',
  6, 25708, 30000, 184248, 0, 184248, 184248, 0, 0, '2026-05-01', '2026-05-31',
  'Por hora, eventual: 6 h × $ 25.708 + $ 30.000 de gastos = $ 184.248 [script 160]');

insert into sueldos.pagos (id, periodo_id, empleado_id, tipo, fecha, monto, estado, medio_pago, descripcion, visible_contable) values
 ('7f6bd6ed-0b69-48d1-87eb-203e24bdea69', '0ef58eb7-0a17-43d7-9a2c-9ee89a06238e', 'cc7272c6-50ec-4ba9-a535-047b2a6f8227', 'sueldo', '2026-05-08', 272623,
  'conciliado', 'banco', 'Pago Abr 2026 — Manuel 10 horas abril + $ 24.000 de gastos [script 160]', false),
 ('e32798d4-a891-4df3-b4c3-a6e437fc97d6', '4c3124bd-16a6-40e6-b9a9-07e1a1192daa', 'cc7272c6-50ec-4ba9-a535-047b2a6f8227', 'sueldo', '2026-06-05', 184248,
  'conciliado', 'banco', 'Pago May 2026 — Manuel 6 horas mayo + $ 30.000 de gastos [script 160]', false);

update public.msa_galicia set sueldo_pago_id = '7f6bd6ed-0b69-48d1-87eb-203e24bdea69', estado = 'conciliado', categ = 'Sueldos',
  detalle = 'Manuel 10 horas abril 2026 + $ 24.000 de gastos'
 where id = '5015630e-c85b-4f51-bee4-e68a3a3b37c1' and estado = 'pendiente' and debitos = 272623;
update public.msa_galicia set sueldo_pago_id = 'e32798d4-a891-4df3-b4c3-a6e437fc97d6', estado = 'conciliado', categ = 'Sueldos',
  detalle = 'Manuel 6 horas mayo 2026 + $ 30.000 de gastos'
 where id = '42fa3b63-393c-4e1d-b86b-9fbaaafa1c36' and estado = 'pendiente' and debitos = 184248;

-- Control (sólo lee): 2 períodos, 2 pagos, 2 movimientos conciliados, CUIT cargado.
select (select count(*) from sueldos.periodos where observaciones like '%[script 160]%') periodos,
       (select count(*) from sueldos.pagos where descripcion like '%[script 160]%') pagos,
       (select count(*) from public.msa_galicia where sueldo_pago_id in ('7f6bd6ed-0b69-48d1-87eb-203e24bdea69','e32798d4-a891-4df3-b4c3-a6e437fc97d6') and estado = 'conciliado') movimientos,
       (select cuit_empleado from sueldos.empleados where id = 'cc7272c6-50ec-4ba9-a535-047b2a6f8227') cuit;
