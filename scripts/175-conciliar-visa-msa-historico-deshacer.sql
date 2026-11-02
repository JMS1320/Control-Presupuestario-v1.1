-- ↩️ Deshacer del script 175. Sólo toca lo que creó o cambió el 175 (marcado [script 175]) y vuelve cada cosa a su valor
-- anterior exacto (leído de la base el 02/11/2026 antes de correrlo).

begin;

-- 3 · Los 12 movimientos: sin vínculo y la nota como estaba.
update public.msa_galicia set template_id = null, template_cuota_id = null,
  nota_operador = nullif(regexp_replace(nota_operador, '( · )?\[script 175\] conciliado con su cuota de Tarjeta Visa Business MSA', ''), '')
where nota_operador like '%[script 175]%';

-- 2 · Las 6 cuotas nuevas.
delete from cuotas_egresos_sin_factura where id in (
  '17500000-0000-4000-8000-000000000001', '17500000-0000-4000-8000-000000000002', '17500000-0000-4000-8000-000000000003',
  '17500000-0000-4000-8000-000000000004', '17500000-0000-4000-8000-000000000005', '17500000-0000-4000-8000-000000000006')
  and detalle like '%[script 175]%';

-- 1 · Las 6 cuotas existentes, a como estaban: $ 0, fecha estimada el 5 de cada mes, sin vencimiento ni detalle.
update cuotas_egresos_sin_factura c set monto = 0, fecha_estimada = v.fecha, fecha_vencimiento = null, detalle = null
from (values
  ('41281933-4751-4d1c-bc9c-3107185065c7'::uuid, '2025-08-05'::date),
  ('a2beab92-3ed7-45f1-be03-64833a1fbe6e'::uuid, '2025-09-05'),
  ('83665633-bc87-460b-82a5-b35b340fd5d7'::uuid, '2025-10-05'),
  ('49f84c83-f3d5-4ca8-bbc8-2d104caa18fa'::uuid, '2025-11-05'),
  ('ec57ed74-aa1e-4a4d-bafc-f8fc75abde15'::uuid, '2025-12-05'),
  ('367b2034-d818-4f90-9edc-84b0d07936cb'::uuid, '2026-01-05')
) as v(id, fecha)
where c.id = v.id and c.detalle like '%[script 175]%';

commit;
