-- 163 · AMS: DOS PAGOS DE SUELDO QUE SALIERON POR SANTANDER (DATOS) — OK de JMS 01/11 («la interbancaria entra a Santander…
-- luego el pago que sale hacia Andrés va a la cuenta de sueldos de Andrés, salvo que tenga algún mensaje mío específico»).
--
-- Qué hace: los «Pago de honorarios» de msa.santander del 01/08/2025 ($ 389.920) y 01/09/2025 ($ 238.994) pasan a ser pagos del
-- sueldo de AMS de JULIO y AGOSTO 2025 (como sus pagos de Galicia: lo pagado el 1° del mes siguiente es del mes anterior), se
-- concilian los dos movimientos contra ellos (CATEG Sueldos) y el sueldo de cada mes sube en lo mismo (los meses históricos
-- de AMS están «armados con lo pagado»: si no, quedarían pagados de más).
--   julio 2025:  1.500.000 + 389.920 = 1.889.920
--   agosto 2025: 1.600.000 + 238.994 = 1.838.994
-- El del 08/07/2025 ($ 1.064.403) NO se toca acá: ⚠️ cambió 06/11 — es el sueldo de junio 2025, conciliado por el script 222.
-- Marca «[script 163]». Deshacer: 163-…-deshacer.sql (por ids).

insert into sueldos.pagos (id, periodo_id, empleado_id, tipo, fecha, monto, estado, medio_pago, descripcion, visible_contable) values
 ('380f08ad-02b3-4890-9852-3ca24fbdc964', 'c6dd10e8-c859-43f8-94d7-1ac4587c569c', '8a624ff4-deac-40d9-9f62-9eb5f705afae', 'sueldo', '2025-08-01', 389920,
  'conciliado', 'banco', 'Sueldo AMS jul 2025 — pagado por Santander («Pago de honorarios» Comp. 28667808) [script 163]', false),
 ('4b75b23c-1a5d-4288-9595-d31dbabe5c97', '5abfdadf-1bca-4e21-b334-81e879eed5ba', '8a624ff4-deac-40d9-9f62-9eb5f705afae', 'sueldo', '2025-09-01', 238994,
  'conciliado', 'banco', 'Sueldo AMS ago 2025 — pagado por Santander («Pago de honorarios» Comp. 29102404) [script 163]', false);

update sueldos.periodos set monto_a = monto_a + 389920, bruto_calculado = bruto_calculado + 389920, anticipos_descontados = anticipos_descontados + 389920,
  observaciones = observaciones || ' · + $ 389.920 pagado por Santander el 01/08/2025 [script 163]'
 where id = 'c6dd10e8-c859-43f8-94d7-1ac4587c569c' and monto_a = 1500000;
update sueldos.periodos set monto_a = monto_a + 238994, bruto_calculado = bruto_calculado + 238994, anticipos_descontados = anticipos_descontados + 238994,
  observaciones = observaciones || ' · + $ 238.994 pagado por Santander el 01/09/2025 [script 163]'
 where id = '5abfdadf-1bca-4e21-b334-81e879eed5ba' and monto_a = 1600000;

update msa.santander set sueldo_pago_id = '380f08ad-02b3-4890-9852-3ca24fbdc964', estado = 'conciliado', categ = 'Sueldos',
  detalle = 'Sueldo AMS julio 2025', proveedor_nombre = 'AMS'
 where id = '7d5fae13-6d72-4451-ade4-02f72ee2eca5' and estado = 'pendiente' and debitos = 389920;
update msa.santander set sueldo_pago_id = '4b75b23c-1a5d-4288-9595-d31dbabe5c97', estado = 'conciliado', categ = 'Sueldos',
  detalle = 'Sueldo AMS agosto 2025', proveedor_nombre = 'AMS'
 where id = 'a394d55b-9938-4cc4-946b-1ae07bb3c709' and estado = 'pendiente' and debitos = 238994;

-- Control (sólo lee)
select (select count(*) from sueldos.pagos where descripcion like '%[script 163]%') pagos,
       (select string_agg(mes || ':' || monto_a, ' ') from sueldos.periodos where id in ('c6dd10e8-c859-43f8-94d7-1ac4587c569c','5abfdadf-1bca-4e21-b334-81e879eed5ba')) meses,
       (select count(*) from msa.santander where sueldo_pago_id in ('380f08ad-02b3-4890-9852-3ca24fbdc964','4b75b23c-1a5d-4288-9595-d31dbabe5c97') and estado = 'conciliado') movimientos;
