-- 289 · Los 2 pagos al albañil Víctor (chalet) pasan de «Otros Gastos» de MSA a «Otros Gastos» de MA — JMS 19/11/2026
-- (A-FEAT-1629 punto 33, paso 1 del balance).
--
-- JMS: «los dos pagos a albañil Víctor deberían en realidad estar en un template de MA y no de MSA, y entonces como lo pagó MSA le
-- queda CTA MA en contable» · «que vaya a Otros Gastos de MA… centro de costo Chalet» · «está bien Mantenimiento edilicio y crear el
-- template Otros Gastos de MA, y contable iría CTA MA. Debe estar conciliado contra el movimiento de caja, así que debe tener la
-- misma fecha que caja».
--
-- Qué hace (todo por id):
--   1 · crea el template «Otros Gastos» de MA (copia del de MSA 995537c7…, abierto, cada cuota con su categoría). Marcado [script 289].
--   2 · pasa las 2 cuotas de 400.000,00 a ese template. Categoría (MANTENIMIENTO EDILICIO) y centro de costo (Chalet) no cambian.
--   3 · la cuota 10033407… toma la fecha de su salida de caja: 19/05/2026 → 16/05/2026 (la otra ya coincide).
--   4 · las 2 salidas de Caja Sigot: template_id al template nuevo y contable «CTA MA X» → «CTA MA». La conciliación no se toca.
-- Deshacer: 289-albanil-chalet-a-otros-gastos-ma-deshacer.sql

begin;

insert into public.egresos_sin_factura
select (jsonb_populate_record(null::public.egresos_sin_factura,
  to_jsonb(e) || jsonb_build_object(
    'id', 'd8d312ba-3d39-4b8f-94b3-4ccf5d0f6514',
    'responsable', 'MA',
    'template_origen_id', null,
    'observaciones_template', '[script 289] JMS 19/11: «Otros Gastos» de MA, como el de MSA — nace con los 2 pagos al albañil del chalet (pagados por MSA, Caja Sigot)',
    'created_at', now(), 'updated_at', now()))).*
from public.egresos_sin_factura e
where e.id = '995537c7-91c0-4c7c-8fe3-3df0d5469944'
  and not exists (select 1 from public.egresos_sin_factura x where x.id = 'd8d312ba-3d39-4b8f-94b3-4ccf5d0f6514');

update public.cuotas_egresos_sin_factura
set egreso_id = 'd8d312ba-3d39-4b8f-94b3-4ccf5d0f6514', updated_at = now()
where id in ('10033407-a616-4d12-b8ba-31d56b06cc7e', '88e3ffe7-8275-461d-96bb-7ea84e499d47')
  and egreso_id = '995537c7-91c0-4c7c-8fe3-3df0d5469944';

update public.cuotas_egresos_sin_factura
set fecha_estimada = '2026-05-16', fecha_vencimiento = '2026-05-16'
where id = '10033407-a616-4d12-b8ba-31d56b06cc7e' and fecha_estimada = '2026-05-19';

update msa.caja_sigot
set template_id = 'd8d312ba-3d39-4b8f-94b3-4ccf5d0f6514', contable = 'CTA MA'
where id in ('a2293466-7ce5-491a-b9c8-2d839b869a14', 'd456e858-e717-4fc0-bf73-13c5c72c16a2')
  and template_id = '995537c7-91c0-4c7c-8fe3-3df0d5469944' and contable = 'CTA MA X';

commit;
