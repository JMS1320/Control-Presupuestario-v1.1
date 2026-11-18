-- 286 · BALANCE PROPIO MSA, versión JMS: la provisión para gastos sale de las dos puntas (DATOS)  A-FEAT-1629
-- JMS 18/11 en esta terminal: «provisión sacalas a las 2». Motivo (JMS): la provisión es una factura de otro ejercicio que entra al
-- balance por haberse originado ahí el gasto; las provisionadas se pagaron, así que para este análisis (activo menos pasivo) no cuenta.
-- Toca 2 filas de public.balance_foto_valores (por id). Deshacer: 286-…-deshacer.sql.

begin;

update public.balance_foto_valores set importe = 0, origen = 'manual', updated_at = now(),
       detalle = '[script 286] no va en el análisis interno (JMS 18/11). Antes: 12456000.14 — [script 273] no estaba en tu foto; se tomaba la del contador (2.1.1/01/04): 2 facturas de arrendamiento de 6.228.000,07'
 where id = 'adf75e00-9ded-4e9c-b186-b1b3d0dd4dad';

update public.balance_foto_valores set importe = 0, origen = 'manual', updated_at = now(),
       detalle = '[script 286] no va en el análisis interno (JMS 18/11). Antes: 778144.76 — [script 273] 10 facturas de gastos del ejercicio que llegaron después (papel 05) · P8'
 where id = '2ce796f5-e03b-436c-b153-7f2ce0fd9a0a';

commit;
