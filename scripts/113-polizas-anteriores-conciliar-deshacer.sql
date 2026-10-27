-- =====================================================================================
-- 113 · DESHACER — conciliación de los 11 débitos de las pólizas anteriores (A-FEAT-1385)
-- =====================================================================================
-- Devuelve los 11 movimientos y las 11 cuotas a la FOTO tomada el 2026-10-27 antes de correr
-- scripts/113-polizas-anteriores-conciliar.mts (sin template, cuotas «pendiente»; los 3 de 2026 en «auditar»
-- con categ «INVALIDA:»). Hay que correrlo ANTES del deshacer del 112 (ése se frena si hay débitos atados).
-- =====================================================================================
begin;

update public.msa_galicia set template_id = null, template_cuota_id = null
 where id in ('05bddaf8-c6b3-4747-bdfa-b0c321c01dd3','5beb2cf1-50f8-4cf2-8f87-292fc01aab85','a86e4cd8-be13-449d-a7a0-985fb1b6f341',
              'c81b1780-9f9d-48f5-89d0-db2bfb99ae63','50f9f2a3-f509-4990-87de-9eca2a76ee86','42e831be-20bc-4dd5-895a-9dd5574b9c18',
              'b0dc44e6-fd0a-4bfa-a8c9-c9950fd24060','5ea328ae-e63f-411b-bc70-7673e83a422a');

update public.msa_galicia set template_id = null, template_cuota_id = null, estado = 'auditar', categ = 'INVALIDA:'
 where id in ('07c4d88e-dea2-42e4-87cf-76b399f14dab','d460aa0d-213b-4bbe-a556-bb9fd2e612ca','4212b2bd-343d-4827-a74a-90164e991cd5');

update public.cuotas_egresos_sin_factura set estado = 'pendiente'
 where egreso_id in ('f995e08d-1f18-4ebc-b077-3b8a1cbbe79b','258a2f69-febb-442e-98e5-177d48242896');

commit;
