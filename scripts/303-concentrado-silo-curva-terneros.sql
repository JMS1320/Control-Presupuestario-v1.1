-- 303 · A-FEAT-1663 — Cría: concentrado al 21 %, silo de maíz en la receta y la curva de los terneros al pie (DATOS, OK de JMS 25/11)
-- JMS: «concentrado va al 21 % de IVA» · «terneros al pie nacen con 30 kilos el 1/7 y se destetan con 200 kilos el 28/2» ·
-- «silo de maíz: son 15 ha, se pagan esos 200 US$ en marzo».
-- Deshacer: 303-…-deshacer.sql (foto de los valores del 25/11 antes de correr).
update productivo.actividad_insumos set iva_pct = 21, updated_at = now()
where id in ('34c05560-6bac-4df4-b7c3-9f89ca57a9c1', '3dfaad83-17e9-4336-896d-6134a1ced07f', 'cf06a833-6b59-4241-8bba-761be5411542');
-- Silo: labor US$ 200/ha × 15 ha, en marzo de cada campaña (antes: 27,6 U$S/ton MV sin hectáreas → «falta un dato»).
update productivo.actividad_insumos set valor = 200, unidad = 'U$S/ha (labor)', has_aplicacion = 15, meses_pct = '{"3": 100}'::jsonb,
  fundamento = '[script 303] JMS 25/11: 15 ha, labor US$ 200/ha, se paga en marzo.', updated_at = now()
where id = '0957e99f-a05f-4e3a-877b-50bcf9572a26';
-- Terneros al pie: 30 kg el 1/7 → 200 kg el 28/2 = 170 kg en 242 días = 0,7025 kg/día (la ganancia del tramo de creep feeding).
update productivo.lote_tramos set ganancia_diaria_kg = 0.7025, notas = '[script 303] JMS 25/11: nacen 30 kg el 1/7, destete 200 kg el 28/2 → 0,7025 kg/día', updated_at = now()
where id = '1dea1b5d-a402-4216-8734-270e994f7d27';
