-- Script 206 — 05/11/2026, con OK de JMS («1 ok»): la provisión del ejercicio 24/25 de MSA son las dos facturas de
-- arrendamiento agrícola 24/25 (servicio devengado al 30/06/2025, facturado en agosto y octubre de 2025). Suman
-- $ 12.456.000,14 = la «Provisión para gastos» del balance anterior. Viven en msa.comprobantes_historico.
-- Marca: «[script 206]» en creado_por. Deshacer: 206-provision-24-25-arrendamientos-msa-deshacer.sql
insert into public.ajustes_balance (empresa, anio_cierre, accion, concepto, categ, monto, valor_sistema, motivo, tabla, registro_id, creado_por)
select 'MSA', 2025, 'incluir', x.concepto, 'ARRENDAMIENTOS AGRICOLAS Compra', 6228000.07, 6228000.07,
  'Arrendamiento agrícola 24/25: servicio devengado al 30/06/2025, facturado después del cierre (provisión del balance anterior)',
  'msa.comprobantes_historico', x.id, '[script 206]'
from (values
  ('99361106-cb8d-435b-8a5a-6d8284128fe4', 'Provisión: SUCESION DE MARTINEZ PLACIDO ALBERTO 2-31 del 19/08/2025'),
  ('895530e5-31c0-449e-ab8f-86e8965a5b37', 'Provisión: MARTINEZ MARIA MAGDALENA 10-269 del 17/10/2025')
) as x(id, concepto)
where not exists (select 1 from public.ajustes_balance a where a.registro_id = x.id and a.accion = 'incluir' and a.anulado_at is null);
