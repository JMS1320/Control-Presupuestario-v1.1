-- 291 · El pasaje del 15/07/2026 toma el código de la cuenta de JMS, y la regla de los templates de JMS vale también para la tarjeta
-- — JMS 19/11/2026 (A-FEAT-1629 punto 36).
--
-- JMS: «1 sí, cambialo por favor» (el pasaje del 15/07/2026, 188.615,00, está en «Viáticos JMS» pero se concilió antes de la regla y
-- quedó sin código) · «¿la regla no puede ser del template, pague por donde se pague?».
--
-- Qué hace (todo por id):
--   1 · el movimiento de Galicia MSA del 15/07/2026 (188.615,00) pasa de contable vacío a «CTA JMS».
--   2 · suma la regla «CTA JMS» de «Viáticos JMS» y de «Gastos Reintegro JMS» para la VISA Business de MSA. Marcadas [script 291].
--       (Que la regla valga para cualquier cuenta sin cargarla una por una es un cambio de la conciliación → pendiente aparte.)
-- Deshacer: 291-pasaje-julio-cta-jms-y-regla-tarjeta-deshacer.sql

begin;

update public.msa_galicia
set contable = 'CTA JMS'
where id = 'b1e4e0f9-10cc-4e3d-9bcf-4d3e8014a52f' and coalesce(contable, '') = ''
  and template_id = '6c78bcdc-6108-4bcf-b852-5fd89e83df2b';

insert into public.reglas_contable_interno (id, orden, activo, cuenta_bancaria_id, tipo_regla, template_id, codigo_contable, descripcion)
select v.id::uuid, 0, true, 'tarjeta_visa_business_msa', 'especifica', v.template_id::uuid, 'CTA JMS', v.descripcion
from (values
  ('2fb75173-2063-4864-b57e-304332fb8913', '6c78bcdc-6108-4bcf-b852-5fd89e83df2b', '[script 291] JMS 19/11: viáticos de JMS pagados con la VISA de MSA — pago a su cuenta'),
  ('9b9e3561-0756-4db4-be43-5950cc4e5734', 'e7e4b87a-8ca0-46ce-8011-b422bcc6fa54', '[script 291] JMS 19/11: reintegro a JMS pagado con la VISA de MSA — pago a su cuenta')
) as v(id, template_id, descripcion)
where not exists (select 1 from public.reglas_contable_interno r where r.id = v.id::uuid);

commit;
