-- DESHACER del 289 · vuelve los 2 pagos al albañil Víctor a «Otros Gastos» de MSA, como estaban el 19/11/2026 antes del script.
-- Sólo toca lo que el 289 cambió (por id) y sólo borra el template que el 289 creó (marcado [script 289]) si no le cuelga nada más.

begin;

update msa.caja_sigot
set template_id = '995537c7-91c0-4c7c-8fe3-3df0d5469944', contable = 'CTA MA X'
where id in ('a2293466-7ce5-491a-b9c8-2d839b869a14', 'd456e858-e717-4fc0-bf73-13c5c72c16a2')
  and template_id = 'd8d312ba-3d39-4b8f-94b3-4ccf5d0f6514';

update public.cuotas_egresos_sin_factura
set fecha_estimada = '2026-05-19', fecha_vencimiento = '2026-05-19'
where id = '10033407-a616-4d12-b8ba-31d56b06cc7e' and fecha_estimada = '2026-05-16';

update public.cuotas_egresos_sin_factura
set egreso_id = '995537c7-91c0-4c7c-8fe3-3df0d5469944'
where id in ('10033407-a616-4d12-b8ba-31d56b06cc7e', '88e3ffe7-8275-461d-96bb-7ea84e499d47')
  and egreso_id = 'd8d312ba-3d39-4b8f-94b3-4ccf5d0f6514';

delete from public.egresos_sin_factura
where id = 'd8d312ba-3d39-4b8f-94b3-4ccf5d0f6514'
  and observaciones_template like '[script 289]%'
  and not exists (select 1 from public.cuotas_egresos_sin_factura c where c.egreso_id = 'd8d312ba-3d39-4b8f-94b3-4ccf5d0f6514');

commit;
