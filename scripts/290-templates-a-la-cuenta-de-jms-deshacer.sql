-- DESHACER del 290 · vuelve «Viáticos JMS» a «Pasajes», saca las 2 reglas que creó el 290 y devuelve el pasaje del 19/05/2026 a
-- «Otros Gastos» de MSA. Sólo toca lo que el 290 cambió (por id) y sólo borra las reglas marcadas [script 290].

begin;

update public.msa_galicia
set template_id = '995537c7-91c0-4c7c-8fe3-3df0d5469944'
where id = '5371c7f0-4db8-4739-b252-c71491770167' and template_id = '6c78bcdc-6108-4bcf-b852-5fd89e83df2b';

update public.cuotas_egresos_sin_factura
set egreso_id = '995537c7-91c0-4c7c-8fe3-3df0d5469944'
where id = 'f90ed55e-db80-4feb-af83-9741b6f293bf' and egreso_id = '6c78bcdc-6108-4bcf-b852-5fd89e83df2b';

delete from public.reglas_contable_interno
where id in ('99c0fc66-e01c-4553-b8b9-5a614a18a8e5', '1bc494dd-315e-41e0-9521-868dfac0790d')
  and descripcion like '[script 290]%';

update public.egresos_sin_factura
set nombre_referencia = 'Pasajes'
where id = '6c78bcdc-6108-4bcf-b852-5fd89e83df2b' and nombre_referencia = 'Viáticos JMS';

commit;
