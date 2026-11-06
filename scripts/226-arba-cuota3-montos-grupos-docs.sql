-- 226 · ARBA INMOBILIARIO 2026 CUOTA 3 (vto 08/09/2026): montos reales, grupos como se pagó y documentos vinculados (DATOS).
-- JMS 06/11: «propuestas 1, 2 avanzá y yo las concilio. pero vos podés linkear los docs antes».
--
-- De dónde sale cada número:
--   · Los 8 débitos de MSA Galicia del 08/09/2026 y los 6 comprobantes de «INMOBILIARIO/2026/Comprobantes Cuota 3» (leídos el 06/11).
--   · Dentro de una liquidación integrada el comprobante no trae el detalle por partida: se reparte con las boletas de la CUOTA 4
--     (cargadas, partida por partida). La cuota 3 es exactamente 0,968770 × la cuota 4 en TODAS las partidas (verificado con las
--     Taperas, Lima, el complementario de MSA y Quinta Rosello 2, que tienen comprobante o boleta propios). Redondeo a 0,10; el
--     residuo (−0,10 en PAM) va a la partida más grande. Cada grupo suma exacto su débito.
--   · Quinta Rosello 1 y 2: sus boletas de la cuota 3 (48.621,00 y 21.012,70). NO están pagadas en el extracto de MSA.
--   · Complementario PAM: NO se toca (no aparece en MSA; la cuenta corriente de PAM está cargada sólo hasta el 07/08). Por la
--     misma proporción sería ≈ $ 1.070.977 (cuota 4 $ 1.105.502,50 × 0,96877).
--
-- Qué escribe:
--   1) public.cuotas_egresos_sin_factura: monto de 19 cuotas; las 3 Taperas salen del grupo de PAM (se pagaron una por una).
--   2) msa.grupos_pago: monto_total de los 4 grupos de la cuota 3.
--   3) public.boletas_arba: 19 filas cuota '3' con su documento (comprobante de pago o boleta) y su cuota_id — el 📎 de la cuota.
--      origen 'comprobante_pago' cuando el documento es el comprobante, 'pdf' cuando es la boleta. Marca «[script 226]».
-- La CONCILIACIÓN la hace JMS en la app. Deshacer: 226-…-deshacer.sql (vuelve montos y grupos a lo de hoy y borra sólo sus boletas).

begin;

-- 1) montos reales de la cuota 3
update public.cuotas_egresos_sin_factura c set monto = v.monto
from (values
  -- MSA liquidación integrada ($ 2.737.296,50 · comprobante 60)
  ('850f3af2-8036-4c48-b095-4992df10cc20'::uuid, 2383380.20), -- Rojas
  ('d444ca18-1500-49de-9552-01739ce798a3'::uuid,   76169.40), -- Anexo
  ('07ced8ff-8a00-453d-be48-8007632e4b0b'::uuid,   22394.70), -- Cholo 1
  ('f883f566-a31d-4b65-8762-db5ecee75e7e'::uuid,   22255.20), -- Cholo 2
  ('ac133c13-355d-4f64-8770-806ac2bcb065'::uuid,   63458.50), -- Portería Nuevo
  ('3670bcfa-d8f2-4bb1-bbbb-55af2db3ae7f'::uuid,   63458.80), -- Portería Viejo
  ('2e089b8a-97ec-456b-a585-a80c50fcac36'::uuid,   65245.60), -- Sánchez
  ('c8b51de2-5ee0-4e13-b7fd-318483100107'::uuid,   40934.10), -- Tango Prim Leboso
  -- Tango Parra ×2, liquidación integrada con CUIT de PAM ($ 115.776,90 · comprobante 63)
  ('b8ad831e-4ab4-4a9a-8829-fe6367711085'::uuid,   40934.10), -- Tango Parra 1
  ('11b05557-2065-45ec-a037-fa8f41121980'::uuid,   74842.80), -- Tango Parra 2
  -- PAM liquidación integrada ($ 1.920.987,70 · comprobante 61)
  ('34e00a2e-f956-4a64-93b7-dd7c67ebeb29'::uuid, 1362096.30), -- Casco
  ('05024932-c6e4-4aa0-a999-b660120bef69'::uuid,   31850.10), -- Entre Ríos
  ('6c264952-4728-4e87-a694-de1385d4e61d'::uuid,  527041.30), -- Ombú
  -- Taperas, una por una (comprobantes 62 y 65)
  ('ce69821e-3ad8-43d5-8bbf-c3008611dc79'::uuid,   40550.90), -- Tapera 1 (099-015882-7)
  ('efa6a267-762c-477c-aa2f-ed081c8e1c13'::uuid,   39224.50), -- Tapera 2 (099-015884-3)
  ('4bfce29c-0c47-4077-b90b-1d49491a0897'::uuid,   38847.30), -- Tapera 3 (099-015886-0)
  -- sueltas
  ('41b7f0a8-3ad9-48e9-8b01-754c4700dc1c'::uuid,  810725.20), -- Lima MA (comprobante 64)
  ('d3e43f7c-2066-4936-8c12-23ec63b7092b'::uuid,  971114.20), -- Complementario MSA (débito automático)
  -- Quinta Rosello (boletas; sin pago a la vista)
  ('5fb13ded-39d3-47a8-aae3-60eb30326772'::uuid,   48621.00), -- Quinta Rosello 1
  ('be4103f0-0bb1-414a-8991-99212c69da4c'::uuid,   21012.70)  -- Quinta Rosello 2
) v(id, monto)
where c.id = v.id and c.fecha_vencimiento = '2026-09-08' and c.estado = 'pendiente';

-- las Taperas se pagaron aparte: salen del grupo de PAM
update public.cuotas_egresos_sin_factura set grupo_pago_id = null
 where id in ('ce69821e-3ad8-43d5-8bbf-c3008611dc79','efa6a267-762c-477c-aa2f-ed081c8e1c13','4bfce29c-0c47-4077-b90b-1d49491a0897')
   and grupo_pago_id = '6fb82662-484f-4364-bee2-0fb117b9ac50';

-- 2) el total de cada grupo = su débito
update msa.grupos_pago g set monto_total = v.total
from (values
  ('ee6556be-fcb4-427e-969d-3ded5d94c3e4'::uuid, 2737296.50),
  ('48a7bcbf-58af-42ce-8d0d-8e6c7357fc34'::uuid,  115776.90),
  ('6fb82662-484f-4364-bee2-0fb117b9ac50'::uuid, 1920987.70),
  ('252485d9-3c81-4c96-9744-c2f733e0f3ef'::uuid,   69633.70)
) v(id, total)
where g.id = v.id;

-- 3) el documento de cada cuota (📎)
insert into public.boletas_arba (partida, anio, cuota, impuesto, importe, vencimiento, archivo_file_id, archivo_url, archivo_nombre,
                                 egreso_id, cuota_id, aplicada, aplicada_at, origen, observaciones)
select e.partida_arba, 2026, '3', 'inmobiliario', c.monto, '2026-09-08', d.file_id,
       'https://drive.google.com/file/d/' || d.file_id || '/view', d.nombre,
       c.egreso_id, c.id, true, now(), d.origen,
       d.nota || ' [script 226]'
from (values
  ('850f3af2-8036-4c48-b095-4992df10cc20'::uuid, '1opX3hI_tjg44G1Yt9w0BOwktDay3whrv', 'Cuota 3 - comprobante (60) - MSA liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada MSA $ 2.737.296,50 (monto de la partida: proporción de la cuota 4)'),
  ('d444ca18-1500-49de-9552-01739ce798a3'::uuid, '1opX3hI_tjg44G1Yt9w0BOwktDay3whrv', 'Cuota 3 - comprobante (60) - MSA liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada MSA $ 2.737.296,50 (monto de la partida: proporción de la cuota 4)'),
  ('07ced8ff-8a00-453d-be48-8007632e4b0b'::uuid, '1opX3hI_tjg44G1Yt9w0BOwktDay3whrv', 'Cuota 3 - comprobante (60) - MSA liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada MSA $ 2.737.296,50 (monto de la partida: proporción de la cuota 4)'),
  ('f883f566-a31d-4b65-8762-db5ecee75e7e'::uuid, '1opX3hI_tjg44G1Yt9w0BOwktDay3whrv', 'Cuota 3 - comprobante (60) - MSA liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada MSA $ 2.737.296,50 (monto de la partida: proporción de la cuota 4)'),
  ('ac133c13-355d-4f64-8770-806ac2bcb065'::uuid, '1opX3hI_tjg44G1Yt9w0BOwktDay3whrv', 'Cuota 3 - comprobante (60) - MSA liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada MSA $ 2.737.296,50 (monto de la partida: proporción de la cuota 4)'),
  ('3670bcfa-d8f2-4bb1-bbbb-55af2db3ae7f'::uuid, '1opX3hI_tjg44G1Yt9w0BOwktDay3whrv', 'Cuota 3 - comprobante (60) - MSA liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada MSA $ 2.737.296,50 (monto de la partida: proporción de la cuota 4)'),
  ('2e089b8a-97ec-456b-a585-a80c50fcac36'::uuid, '1opX3hI_tjg44G1Yt9w0BOwktDay3whrv', 'Cuota 3 - comprobante (60) - MSA liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada MSA $ 2.737.296,50 (monto de la partida: proporción de la cuota 4)'),
  ('c8b51de2-5ee0-4e13-b7fd-318483100107'::uuid, '1opX3hI_tjg44G1Yt9w0BOwktDay3whrv', 'Cuota 3 - comprobante (60) - MSA liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada MSA $ 2.737.296,50 (monto de la partida: proporción de la cuota 4)'),
  ('b8ad831e-4ab4-4a9a-8829-fe6367711085'::uuid, '1ZLnNVB3lBILUvjmd3uLvfhrXctaj4ULj', 'Cuota 3 - comprobante (63) - Tango x2 liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada CUIT PAM (Tango Parra ×2) $ 115.776,90 (monto de la partida: proporción de la cuota 4)'),
  ('11b05557-2065-45ec-a037-fa8f41121980'::uuid, '1ZLnNVB3lBILUvjmd3uLvfhrXctaj4ULj', 'Cuota 3 - comprobante (63) - Tango x2 liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada CUIT PAM (Tango Parra ×2) $ 115.776,90 (monto de la partida: proporción de la cuota 4)'),
  ('34e00a2e-f956-4a64-93b7-dd7c67ebeb29'::uuid, '1e3yjfnMpAeL3RH3JTMI5Mms1zhDZAnOX', 'Cuota 3 - comprobante (61) - PAM liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada PAM $ 1.920.987,70 (monto de la partida: proporción de la cuota 4)'),
  ('05024932-c6e4-4aa0-a999-b660120bef69'::uuid, '1e3yjfnMpAeL3RH3JTMI5Mms1zhDZAnOX', 'Cuota 3 - comprobante (61) - PAM liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada PAM $ 1.920.987,70 (monto de la partida: proporción de la cuota 4)'),
  ('6c264952-4728-4e87-a694-de1385d4e61d'::uuid, '1e3yjfnMpAeL3RH3JTMI5Mms1zhDZAnOX', 'Cuota 3 - comprobante (61) - PAM liq. integrada.pdf', 'comprobante_pago', 'Pago 08/09/2026 liq. integrada PAM $ 1.920.987,70 (monto de la partida: proporción de la cuota 4)'),
  ('ce69821e-3ad8-43d5-8bbf-c3008611dc79'::uuid, '1iMPOIYg610oroywANJNDSKYFHIujaTX0', 'Cuota 3 - comprobante (62) - Tapera 1 y 2.pdf', 'comprobante_pago', 'Pago 08/09/2026 $ 40.550,90 (hoja 1 del comprobante)'),
  ('efa6a267-762c-477c-aa2f-ed081c8e1c13'::uuid, '1iMPOIYg610oroywANJNDSKYFHIujaTX0', 'Cuota 3 - comprobante (62) - Tapera 1 y 2.pdf', 'comprobante_pago', 'Pago 08/09/2026 $ 39.224,50 (hoja 2 del comprobante)'),
  ('4bfce29c-0c47-4077-b90b-1d49491a0897'::uuid, '1Oh9cDaCfO3cxWmz5ZxmqL_kH2nd_ELX9', 'Cuota 3 - comprobante (65) - Tapera 3.pdf', 'comprobante_pago', 'Pago 08/09/2026 $ 38.847,30'),
  ('41b7f0a8-3ad9-48e9-8b01-754c4700dc1c'::uuid, '1mwM0nuhotlGMVqzBr0cAD0NLpu97cAEy', 'Cuota 3 - comprobante (64) - Lima.pdf', 'comprobante_pago', 'Pago 08/09/2026 $ 810.725,20'),
  ('5fb13ded-39d3-47a8-aae3-60eb30326772'::uuid, '1JK6pRSPl83-dmWk9DJ9mhBrtAlf0EoH4', '2026 - Inmob - Cuota 3 - Quinta Rosello 1.pdf', 'pdf', 'Boleta cuota 3 $ 48.621,00 — sin pago a la vista en el extracto de MSA'),
  ('be4103f0-0bb1-414a-8991-99212c69da4c'::uuid, '1qhBJodbb0qPTBCQdIrKoL9TfDUKOXKxU', '2026 - Inmob - Cuota 3 - Quinta Rosello 2.pdf', 'pdf', 'Boleta cuota 3 $ 21.012,70 — sin pago a la vista en el extracto de MSA')
) d(cuota_id, file_id, nombre, origen, nota)
join public.cuotas_egresos_sin_factura c on c.id = d.cuota_id
join public.egresos_sin_factura e on e.id = c.egreso_id
where not exists (select 1 from public.boletas_arba b where b.partida = e.partida_arba and b.anio = 2026 and b.cuota = '3' and b.impuesto = 'inmobiliario');

commit;

-- Control (sólo lee): cada grupo suma su débito · 19 boletas nuevas
select g.id, g.monto_total, (select sum(monto) from public.cuotas_egresos_sin_factura c where c.grupo_pago_id = g.id and c.fecha_vencimiento = '2026-09-08') suma_cuotas
  from msa.grupos_pago g where g.id in ('ee6556be-fcb4-427e-969d-3ded5d94c3e4','48a7bcbf-58af-42ce-8d0d-8e6c7357fc34','6fb82662-484f-4364-bee2-0fb117b9ac50','252485d9-3c81-4c96-9744-c2f733e0f3ef');
select count(*) boletas_226 from public.boletas_arba where observaciones like '%[script 226]%';
