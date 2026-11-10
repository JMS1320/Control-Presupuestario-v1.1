-- 238 · Pagos a Victor (albañil del CHALET) por Caja Sigot ↔ sus 2 cuotas de «Otros Gastos» + cuenta nueva MANTENIMIENTO EDILICIO (DATOS) — A-FEAT-1579.
-- OK JMS 09/11: «son pagos al albañil Victor, salieron por caja Sigot… "CTA MA X"… y DIST MA en interno… Chalet el centro de costo» · «A5.3 mantenimiento edilicio».
-- Las 2 cuotas ($ 400.000, 19/05/26) estaban «conciliado» sin movimiento; los 2 pagos de la caja (16 y 19/05) sin vincular.
-- Foto: scripts/238-foto-antes.json · Deshacer: 238-…-deshacer.sql.
begin;
insert into public.cuentas_contables (categ, cuenta_contable, tipo, activo, nro_cuenta, imputable, cta_totalizadora, nombre_totalizadora, cambio_nombre_cta)
select 'MANTENIMIENTO EDILICIO', 'MANTENIMIENTO EDILICIO', 'egreso', true, '422141', true, '4221', 'ADMINISTRACION Y ESTRUCTURA', 'creada 09-11 [script 238]'
where not exists (select 1 from public.cuentas_contables where nro_cuenta = '422141' or categ = 'MANTENIMIENTO EDILICIO');
update msa.caja_sigot set template_cuota_id='10033407-a616-4d12-b8ba-31d56b06cc7e', template_id='995537c7-91c0-4c7c-8fe3-3df0d5469944', estado='conciliado',
  categ='MANTENIMIENTO EDILICIO', nro_cuenta='422141', centro_de_costo='Chalet', contable='CTA MA X', interno='DIST MA'
  where id='a2293466-7ce5-491a-b9c8-2d839b869a14' and template_cuota_id is null;
update msa.caja_sigot set template_cuota_id='88e3ffe7-8275-461d-96bb-7ea84e499d47', template_id='995537c7-91c0-4c7c-8fe3-3df0d5469944', estado='conciliado',
  categ='MANTENIMIENTO EDILICIO', nro_cuenta='422141', centro_de_costo='Chalet', contable='CTA MA X', interno='DIST MA'
  where id='d456e858-e717-4fc0-bf73-13c5c72c16a2' and template_cuota_id is null;
update public.cuotas_egresos_sin_factura set categ='MANTENIMIENTO EDILICIO', centro_costo='Chalet', descripcion='Pago Victor ALBAÑIL CHALET'
  where id in ('10033407-a616-4d12-b8ba-31d56b06cc7e','88e3ffe7-8275-461d-96bb-7ea84e499d47') and descripcion is null;
commit;
