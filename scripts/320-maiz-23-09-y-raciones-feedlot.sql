-- [script 320] DATOS (con OK de JMS 27/11) — A-FEAT-1663 / A-FEAT-1670.
-- (1) El maíz al corte: JMS 27/11 «el stock al 23 o 24/9 era de 6.000 kg de maíz + 25.560 de Longo que ya había llegado» (y el 🚩 4f709726 del 24/09:
--     «31.650 kg de maíz… al día del 23/9»; 6.000 + 25.560 = 31.560 → se toma la suma, el 31.650 del 🚩 parece de tipeo).
--     · medición del maíz al 23/09: 6.000 → 31.560 (con su huella);
--     · la entrada de Longo (FC 0002-540) pasa del 06/10 (fecha de la factura) al 22/09: llegó antes del corte (día exacto sin dato; basta con que sea
--       antes de la medición). El vínculo con la factura no cambia.
-- (2) Las TRES raciones del feed lot, «tal cual fueron y que afecten así al stock» (JMS 27/11), de los 🚩 del 24/09 y del 25/09 (+ su seguimiento del
--     06/10), kg por día para las 52 cabezas → kg por cabeza y día, en el plan del año de los DOS lotes (Ternero Recría 40 y Ternera Recría 12):
--        24/09 → 25/09: silo 680 · maíz 240 · núcleo 50     25/09 → 06/10: silo 770 · maíz 275 · núcleo 55     06/10 → fin: silo 910 · maíz 275 · núcleo 65
-- (3) Los dos 🚩 quedan resueltos con lo que se cargó.
-- Antes de correr (verificado 27/11): medición 615fa41f = 6.000 al 23/09; Longo ecec03f2 al 06/10; sin plan de lote para esos lotes; los 2 🚩 abiertos.
-- Deshacer: scripts/320-maiz-23-09-y-raciones-feedlot-deshacer.sql
begin;
update productivo.mediciones_insumo set cantidad = 31560,
  notas = coalesce(notas, '') || ' · [script 320] JMS 27/11: 6.000 + 25.560 de Longo que ya había llegado = 31.560 (antes decía 6.000)'
 where id = '615fa41f-f5b4-495b-8b04-d517acab0983' and cantidad = 6000;
update productivo.movimientos_insumos set fecha = '2026-09-22',
  observaciones = observaciones || ' · [script 320] llegó antes del corte del 23/09 (JMS 27/11): fecha de llegada 22/09 (antes 06/10, la de la factura)'
 where id = 'ecec03f2-345f-46c8-adc1-b4cf0ab84615' and fecha = '2026-10-06';

insert into public.presupuesto_variables (empresa, escenario, campana, concepto, receta_insumo_id, lote_id, cantidad, fecha_desde, fecha_hasta,
  distribucion, fuente_cantidad, fuente_precio, activo, fundamento)
select 'MSA', 'base', '26/27', r.concepto || ' · ' || l.nombre, r.id::uuid, l.id::uuid, round(per.kg / 52.0, 6), per.desde::date, per.hasta::date,
       'calendario', 'manual', 'manual', true, '[script 320] ración del feed lot ' || per.cuando || ': ' || per.kg || ' kg/día para 52 cab (🚩 de JMS)'
from (values ('84a7cb3e-7783-46ef-aa1e-c8a3223d6c3b', 'Ternero Recria'), ('1faa6f50-5c46-48b5-a83e-1db9cd6d5223', 'Ternera Recria')) l(id, nombre)
cross join (values ('ee02f97e-ec04-40d6-be8d-ff58f633f71b', 'Silo de sorgo', 's'), ('08049507-0e67-4404-8879-f2a2861fbab2', 'Maíz', 'm'), ('f305f048-de83-4e6c-bf2b-fd75cd9eb895', 'Núcleo', 'n')) r(id, concepto, k)
join (values
  ('s', 680, '2026-09-24', '2026-09-25', 'del 24/09'), ('m', 240, '2026-09-24', '2026-09-25', 'del 24/09'), ('n', 50, '2026-09-24', '2026-09-25', 'del 24/09'),
  ('s', 770, '2026-09-25', '2026-10-06', 'del 25/09'), ('m', 275, '2026-09-25', '2026-10-06', 'del 25/09'), ('n', 55, '2026-09-25', '2026-10-06', 'del 25/09'),
  ('s', 910, '2026-10-06', null,         'del 06/10'), ('m', 275, '2026-10-06', null,         'del 06/10'), ('n', 65, '2026-10-06', null,         'del 06/10')
) per(k, kg, desde, hasta, cuando) on per.k = r.k
where not exists (select 1 from public.presupuesto_variables where fundamento like '[script 320]%');

update public.revisiones set estado = 'resuelta', resuelto_por = 'Claude', resuelto_at = now(),
  resolucion = '[script 320] Cargado: stock al 23/09 (silo 117.150 · maíz 6.000 + 25.560 de Longo = 31.560 · concentrado Novillo 4.950) y las raciones del feed lot del 24/09, 25/09 y 06/10 en el plan del año de los lotes Ternero Recría y Ternera Recría (Presupuesto → Costos de producción → Engorde → 📅 plan del año).'
 where id in ('4f709726-8fe5-4d35-95e1-c71ee18f6b49', 'dc74944b-66e6-49b0-87bc-66f35817f7e7') and estado = 'abierta';
commit;
