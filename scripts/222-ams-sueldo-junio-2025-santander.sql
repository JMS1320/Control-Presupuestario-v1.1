-- 222 · AMS: EL SUELDO DE JUNIO 2025 QUE SALIÓ POR SANTANDER EL 08/07/2025 (DATOS) — OK de JMS 06/11: «sí, conciliá como sueldo
-- de AMS junio 2025».
--
-- Qué hace: el «Pago de honorarios» de msa.santander del 08/07/2025 ($ 1.064.403) — el que el 163 dejó afuera — pasa a ser el
-- pago del sueldo de AMS de JUNIO 2025, igual que los de agosto y septiembre (script 163: lo pagado a principio de mes es del mes
-- anterior). La plata entró ese día desde Galicia: «Transf Inmed Cp» $ 1.200.000, detalle «Cuenta Santander para Sueldo AMS 1.064.403».
--   1) crea el período AMS 06/2025 (no existía: Sueldos arranca en 07/2025), «armado con lo pagado» como los históricos;
--      sin campaña (la 24/25 no existe en Sueldos). Es del ejercicio ANTERIOR: el papel de sueldos 25/26 recorta por año/mes y no lo suma.
--   2) crea su pago (08/07/2025, conciliado);
--   3) concilia el movimiento de Santander contra ese pago (CATEG Sueldos, como los demás).
-- Marca «[script 222]». Deshacer: 222-…-deshacer.sql (por ids).

begin;

insert into sueldos.periodos (id, empleado_id, campana_id, anio, mes, fecha_inicio_periodo, fecha_fin_periodo,
  monto_a, monto_b, bruto_calculado, sueldo_x_ipc, anticipos_descontados, saldo_pendiente, estado, observaciones)
select '541f0adf-4ef9-40a3-8532-a518dd37b301', '8a624ff4-deac-40d9-9f62-9eb5f705afae', null, 2025, 6, '2025-06-01', '2025-06-30',
  1064403, 0, 1064403, 0, 1064403, 0, 'historico',
  'Histórico jun25 (ejercicio 24/25): armado con lo pagado — $ 1.064.403 por Santander el 08/07/2025 [script 222]'
where not exists (select 1 from sueldos.periodos where empleado_id = '8a624ff4-deac-40d9-9f62-9eb5f705afae' and anio = 2025 and mes = 6);

insert into sueldos.pagos (id, periodo_id, empleado_id, tipo, fecha, monto, estado, medio_pago, descripcion, visible_contable)
select '6e46274b-0711-4a69-bc0c-347b7a52710d', '541f0adf-4ef9-40a3-8532-a518dd37b301', '8a624ff4-deac-40d9-9f62-9eb5f705afae',
  'sueldo', '2025-07-08', 1064403, 'conciliado', 'banco',
  'Sueldo AMS jun 2025 — pagado por Santander («Pago de honorarios» 08/07/2025) [script 222]', false
where exists (select 1 from sueldos.periodos where id = '541f0adf-4ef9-40a3-8532-a518dd37b301');

update msa.santander set sueldo_pago_id = '6e46274b-0711-4a69-bc0c-347b7a52710d', estado = 'conciliado', categ = 'Sueldos',
  detalle = 'Sueldo AMS junio 2025', proveedor_nombre = 'AMS'
 where id = '22fa8a8d-718a-489c-a9ef-443e5c2fe5e7' and sueldo_pago_id is null and debitos = 1064403
   and exists (select 1 from sueldos.pagos where id = '6e46274b-0711-4a69-bc0c-347b7a52710d');

commit;

-- Control (sólo lee): 1 · 1 · 1
select (select count(*) from sueldos.periodos where id = '541f0adf-4ef9-40a3-8532-a518dd37b301') periodo,
       (select count(*) from sueldos.pagos where id = '6e46274b-0711-4a69-bc0c-347b7a52710d') pago,
       (select count(*) from msa.santander where id = '22fa8a8d-718a-489c-a9ef-443e5c2fe5e7' and estado = 'conciliado'
          and sueldo_pago_id = '6e46274b-0711-4a69-bc0c-347b7a52710d') movimiento;
