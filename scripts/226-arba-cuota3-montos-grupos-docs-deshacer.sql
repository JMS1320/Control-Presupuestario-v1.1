-- Deshace 226 · vuelve los montos, los grupos y sus totales a como estaban el 06/11 y borra SÓLO las boletas que creó el 226.
begin;
delete from public.boletas_arba where cuota = '3' and anio = 2026 and observaciones like '%[script 226]%';

update public.cuotas_egresos_sin_factura c set monto = v.monto
from (values
  ('850f3af2-8036-4c48-b095-4992df10cc20'::uuid, 2214038.50), ('d444ca18-1500-49de-9552-01739ce798a3'::uuid, 70757.50),
  ('07ced8ff-8a00-453d-be48-8007632e4b0b'::uuid, 20803.60),   ('f883f566-a31d-4b65-8762-db5ecee75e7e'::uuid, 20674.00),
  ('ac133c13-355d-4f64-8770-806ac2bcb065'::uuid, 58949.70),   ('3670bcfa-d8f2-4bb1-bbbb-55af2db3ae7f'::uuid, 58950.00),
  ('2e089b8a-97ec-456b-a585-a80c50fcac36'::uuid, 60609.90),   ('c8b51de2-5ee0-4e13-b7fd-318483100107'::uuid, 38025.70),
  ('b8ad831e-4ab4-4a9a-8829-fe6367711085'::uuid, 38025.70),   ('11b05557-2065-45ec-a037-fa8f41121980'::uuid, 69525.20),
  ('34e00a2e-f956-4a64-93b7-dd7c67ebeb29'::uuid, 1265318.00), ('05024932-c6e4-4aa0-a999-b660120bef69'::uuid, 29587.10),
  ('6c264952-4728-4e87-a694-de1385d4e61d'::uuid, 489594.40),  ('ce69821e-3ad8-43d5-8bbf-c3008611dc79'::uuid, 38234.80),
  ('efa6a267-762c-477c-aa2f-ed081c8e1c13'::uuid, 36984.10),   ('4bfce29c-0c47-4077-b90b-1d49491a0897'::uuid, 36628.50),
  ('41b7f0a8-3ad9-48e9-8b01-754c4700dc1c'::uuid, 764419.00),  ('d3e43f7c-2066-4936-8c12-23ec63b7092b'::uuid, 915647.30),
  ('5fb13ded-39d3-47a8-aae3-60eb30326772'::uuid, 45843.70),   ('be4103f0-0bb1-414a-8991-99212c69da4c'::uuid, 19812.30)
) v(id, monto)
where c.id = v.id and c.estado = 'pendiente';

update public.cuotas_egresos_sin_factura set grupo_pago_id = '6fb82662-484f-4364-bee2-0fb117b9ac50'
 where id in ('ce69821e-3ad8-43d5-8bbf-c3008611dc79','efa6a267-762c-477c-aa2f-ed081c8e1c13','4bfce29c-0c47-4077-b90b-1d49491a0897')
   and grupo_pago_id is null and estado = 'pendiente';

update msa.grupos_pago g set monto_total = v.total
from (values
  ('ee6556be-fcb4-427e-969d-3ded5d94c3e4'::uuid, 0.00), ('48a7bcbf-58af-42ce-8d0d-8e6c7357fc34'::uuid, 0.00),
  ('6fb82662-484f-4364-bee2-0fb117b9ac50'::uuid, 1794257.10), ('252485d9-3c81-4c96-9744-c2f733e0f3ef'::uuid, 28413.80)
) v(id, total)
where g.id = v.id;
commit;
