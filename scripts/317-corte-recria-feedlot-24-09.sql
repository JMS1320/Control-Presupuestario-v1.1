-- [script 317] DATOS (con OK de JMS 27/11) — el CORTE recría a discreción → feed lot con ración: el 24/09/2026 fue el primer día de ración
-- (JMS: «tomalo como dato… el 23/9 fue el último día de consumo de recría»). A-FEAT-1663.
--  1) las mediciones del 19/09 (maíz 6.000 kg, concentrado Novillo 450 kg = 18 bolsas × 25) pasan al 23/09 (JMS: «había 6.000 kg al 19/9 pero se ve
--     que había alimento en comederos… hay que cambiar sólo la fecha»; «concentrado idem a esa fecha»);
--  2) los lotes Ternero Recría (40) y Ternera Recría (12): la recría termina y el engorde empieza el 24/09 (estaba 15/09) — el fin del tramo no
--     cuenta (días = hasta − desde), así que la recría come hasta el 23/09 inclusive;
--  3) Ternera Recría (69) y Torito (9): «dejaron de comer a discreción la misma fecha» → su recría termina el 24/09 (estaba 01/10);
--  4) el «Núcleo» de la dieta con silo de Engorde es el Concentrado Novillo 35 10 (JMS: «el mismo que se usaba en la recría»).
-- Deshacer: scripts/317-corte-recria-feedlot-24-09-deshacer.sql (vuelve los valores anteriores, por id).
begin;
update productivo.mediciones_insumo set fecha = '2026-09-23' where id in ('615fa41f-f5b4-495b-8b04-d517acab0983','2cad97bd-a498-48e6-993f-6d3e055505e5') and fecha = '2026-09-19';
update productivo.lote_tramos set fecha_hasta = '2026-09-24' where id in ('2ad5c3d1-03f0-4a41-bb56-12b2d7c40ddc','137cffea-769e-4f0a-b8b7-6d8f9d27048a') and fecha_hasta = '2026-09-15';
update productivo.lote_tramos set fecha_desde = '2026-09-24' where id in ('917ede18-c8b4-43f1-bbab-5be7afef092d','4e1a7f99-72b9-48fa-bc8c-6c165e69e248') and fecha_desde = '2026-09-15';
update productivo.lote_tramos set fecha_hasta = '2026-09-24' where id in ('8d6f6092-c9e2-46d4-bc3a-78908c4f6a19','800977fc-3272-4665-ad2f-4a816cef2edd') and fecha_hasta = '2026-10-01';
update productivo.actividad_insumos set insumo_stock_id = 'bf021076-bd4c-42ee-a61c-ddcd0823e947' where id = 'f305f048-de83-4e6c-bf2b-fd75cd9eb895' and insumo_stock_id is null;
commit;
