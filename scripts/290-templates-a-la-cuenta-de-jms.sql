-- 290 · Templates destinados a la cuenta de JMS: «Viáticos JMS» y «Gastos Reintegro JMS» — JMS 19/11/2026
-- (A-FEAT-1629 punto 35, paso 1 del balance).
--
-- JMS: «nunca un pago a JMS va al gasto, sino que va como pago contra sus facturas» · «si el template ya está destinado a trabajarse
-- de esa manera es más fácil: llevan contable JMS automáticamente, no hace falta que yo lo ponga» · «habría que cambiar el nombre del
-- template para que se entienda y no se confunda con pasajes generales».
--
-- Qué hace (todo por id):
--   1 · renombra el template «Pasajes» de MSA (6c78bcdc…) a «Viáticos JMS».
--   2 · crea 2 reglas de código (Galicia MSA): al conciliar contra «Viáticos JMS» o «Gastos Reintegro JMS», el movimiento lleva «CTA JMS».
--       Marcadas [script 290]. Con esa regla el libro de templates las muestra en el bloque «Reintegros a la cuenta de un socio».
--   3 · pasa la cuota del pasaje del 19/05/2026 (261.545,00) de «Otros Gastos» de MSA a «Viáticos JMS». Su categoría no cambia.
--   4 · el movimiento de Galicia de ese pasaje apunta al template nuevo. Su código (CTA JMS) y su conciliación no se tocan.
-- Deshacer: 290-templates-a-la-cuenta-de-jms-deshacer.sql

begin;

update public.egresos_sin_factura
set nombre_referencia = 'Viáticos JMS', updated_at = now()
where id = '6c78bcdc-6108-4bcf-b852-5fd89e83df2b' and nombre_referencia = 'Pasajes';

insert into public.reglas_contable_interno (id, orden, activo, cuenta_bancaria_id, tipo_regla, template_id, codigo_contable, descripcion)
select v.id::uuid, 0, true, 'msa_galicia', 'especifica', v.template_id::uuid, 'CTA JMS', v.descripcion
from (values
  ('99c0fc66-e01c-4553-b8b9-5a614a18a8e5', '6c78bcdc-6108-4bcf-b852-5fd89e83df2b', '[script 290] JMS 19/11: viáticos de JMS — pago a su cuenta, el gasto va por su factura'),
  ('1bc494dd-315e-41e0-9521-868dfac0790d', 'e7e4b87a-8ca0-46ce-8011-b422bcc6fa54', '[script 290] JMS 19/11: reintegro del monotributo de JMS — pago a su cuenta, el gasto va por su factura')
) as v(id, template_id, descripcion)
where not exists (select 1 from public.reglas_contable_interno r where r.id = v.id::uuid);

update public.cuotas_egresos_sin_factura
set egreso_id = '6c78bcdc-6108-4bcf-b852-5fd89e83df2b', updated_at = now()
where id = 'f90ed55e-db80-4feb-af83-9741b6f293bf' and egreso_id = '995537c7-91c0-4c7c-8fe3-3df0d5469944';

update public.msa_galicia
set template_id = '6c78bcdc-6108-4bcf-b852-5fd89e83df2b'
where id = '5371c7f0-4db8-4739-b252-c71491770167' and template_id = '995537c7-91c0-4c7c-8fe3-3df0d5469944';

commit;
