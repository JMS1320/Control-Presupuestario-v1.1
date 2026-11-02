-- 📜 Script 175 — conciliar los 12 «Pago Visa Empresa» del extracto HISTÓRICO de Galicia MSA (jul-25 → ene-26)
-- con las cuotas del template «Tarjeta Visa Business MSA» (A-FEAT-1481 / pregunta de JMS 02/11 en «H · MSA · Tarjetas»:
-- «¿no tenés los extractos para cargar lo que falta? ¿o no está cargado?» → estaba cargado y sin vincular).
-- OK de JMS: «concilialas vos por favor» (02/11, en esta terminal).
--
-- Convención del histórico (A-DEC-1009, como los seguros del script 130): el MOVIMIENTO queda «historico» y se le pone el
-- vínculo (template_id + template_cuota_id); la CUOTA toma el monto y la fecha del banco y queda conciliada.
-- Dos pagos en un mes (pesos y dólares) = dos cuotas, como febrero 2026 en adelante.
--
-- Cambia: 6 cuotas existentes (ago→ene, hoy en $ 0) · 6 cuotas nuevas (julio y el 2º pago de sep→ene) · 12 movimientos.
-- Todo lo que crea o toca lleva la marca [script 175]. Deshacer: 175-conciliar-visa-msa-historico-deshacer.sql

begin;

-- 1 · Las 6 cuotas existentes (ago→ene): el monto y la fecha del pago principal (el mayor del mes).
update cuotas_egresos_sin_factura c set monto = v.monto, fecha_estimada = v.fecha, fecha_vencimiento = v.fecha,
  detalle = 'Tarjeta Visa Business MSA - ' || v.mes || ' [script 175]', estado = 'conciliado'
from (values
  ('41281933-4751-4d1c-bc9c-3107185065c7'::uuid, 912166.95::numeric, '2025-08-11'::date, 'Agosto 2025'),
  ('a2beab92-3ed7-45f1-be03-64833a1fbe6e'::uuid, 1084183.23, '2025-09-08', 'Septiembre 2025'),
  ('83665633-bc87-460b-82a5-b35b340fd5d7'::uuid, 970731.23, '2025-10-13', 'Octubre 2025'),
  ('49f84c83-f3d5-4ca8-bbc8-2d104caa18fa'::uuid, 869492.74, '2025-11-10', 'Noviembre 2025'),
  ('ec57ed74-aa1e-4a4d-bafc-f8fc75abde15'::uuid, 838018.38, '2025-12-09', 'Diciembre 2025'),
  ('367b2034-d818-4f90-9edc-84b0d07936cb'::uuid, 929356.67, '2026-01-12', 'Enero 2026')
) as v(id, monto, fecha, mes)
where c.id = v.id and c.monto = 0 and c.estado = 'conciliado';

-- 2 · Las 6 cuotas nuevas: julio (no tenía cuota) y el segundo pago de sep→ene.
insert into cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_estimada, fecha_vencimiento, monto, estado, detalle, tipo_movimiento, medio_pago)
select v.id, '92adc604-2093-45c7-9a3d-6ddee126784c'::uuid, null, v.fecha, v.fecha, v.monto, 'conciliado',
  'Tarjeta Visa Business MSA - ' || v.mes || ' [script 175]', 'egreso', 'banco'
from (values
  ('17500000-0000-4000-8000-000000000001'::uuid, 887674.27::numeric, '2025-07-07'::date, 'Julio 2025'),
  ('17500000-0000-4000-8000-000000000002'::uuid, 274809.60, '2025-09-08', 'Septiembre 2025 (2º pago)'),
  ('17500000-0000-4000-8000-000000000003'::uuid, 41031.50, '2025-10-13', 'Octubre 2025 (2º pago)'),
  ('17500000-0000-4000-8000-000000000004'::uuid, 43427.50, '2025-11-10', 'Noviembre 2025 (2º pago)'),
  ('17500000-0000-4000-8000-000000000005'::uuid, 43727.00, '2025-12-09', 'Diciembre 2025 (2º pago)'),
  ('17500000-0000-4000-8000-000000000006'::uuid, 220250.10, '2026-01-12', 'Enero 2026 (2º pago)')
) as v(id, monto, fecha, mes)
where not exists (select 1 from cuotas_egresos_sin_factura x where x.id = v.id);

-- 3 · Los 12 movimientos: el vínculo, y la marca en la nota. Siguen «historico» (convención A-DEC-1009).
update public.msa_galicia g set template_id = '92adc604-2093-45c7-9a3d-6ddee126784c', template_cuota_id = v.cuota,
  nota_operador = coalesce(g.nota_operador || ' · ', '') || '[script 175] conciliado con su cuota de Tarjeta Visa Business MSA'
from (values
  ('e6486a18-57ce-4b3b-9c33-0d26580c65c1'::uuid, '17500000-0000-4000-8000-000000000001'::uuid),
  ('20172921-0529-49f2-9759-285f50a7733d'::uuid, '41281933-4751-4d1c-bc9c-3107185065c7'::uuid),
  ('0d2aca9f-8dcf-4176-a5c3-279bf20ea1f1'::uuid, 'a2beab92-3ed7-45f1-be03-64833a1fbe6e'::uuid),
  ('53801ab3-5241-420b-930e-6b94a0d85b62'::uuid, '17500000-0000-4000-8000-000000000002'::uuid),
  ('9f2da302-c3d9-4ac3-9095-782e3d93c877'::uuid, '83665633-bc87-460b-82a5-b35b340fd5d7'::uuid),
  ('2a2fa5b4-1eb0-4f29-a9d7-46cb94815203'::uuid, '17500000-0000-4000-8000-000000000003'::uuid),
  ('827e35f0-56ec-447a-bc06-ad38b0ca408c'::uuid, '49f84c83-f3d5-4ca8-bbc8-2d104caa18fa'::uuid),
  ('981480bb-1b62-418b-aa43-587036c0f54c'::uuid, '17500000-0000-4000-8000-000000000004'::uuid),
  ('8bc4880c-47d5-4ab2-ac9c-fd0f9b4aa2f9'::uuid, 'ec57ed74-aa1e-4a4d-bafc-f8fc75abde15'::uuid),
  ('8024933d-bf70-4de1-a9a1-27163f6a615b'::uuid, '17500000-0000-4000-8000-000000000005'::uuid),
  ('893d24f7-681b-4b83-84e9-a5f2e54da121'::uuid, '367b2034-d818-4f90-9edc-84b0d07936cb'::uuid),
  ('785036c4-a4f9-463d-b1c0-62ddf0fb73b4'::uuid, '17500000-0000-4000-8000-000000000006'::uuid)
) as v(mov, cuota)
where g.id = v.mov and g.template_cuota_id is null;

commit;
