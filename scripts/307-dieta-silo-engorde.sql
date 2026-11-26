-- 307 · A-FEAT-1665 (d) — DATOS. Dieta alternativa «Con silo de sorgo» en la receta de ENGORDE (JMS 26/11: «para engorde hay muchas
-- dietas… ahora estamos usando una que además de maíz y concentrado tiene un silo de sorgo… lo dejé guardado en una nota con una flag»).
-- Fuente: 🚩 del 06/10/2026 (revisión dc74944b): 910 kg silo + 275 kg maíz + 65 kg núcleo POR DÍA para el lote; en engorde había 52
-- cabezas (Ternero Recria 40 + Ternera Recria 12) → kg por cabeza y por día. El silo sale del stock propio (ya pagado): precio 0 en la
-- caja. NO se cambia la dieta por default ni el plan del año: queda como alternativa para elegir.
insert into productivo.actividad_insumos (actividad_id, orden, concepto, modo, valor, unidad, momento, precio_unitario, moneda, iva_pct, dieta, notas)
select '46650501-2eb8-487f-a401-0bc162143790', o, c, 'kg_cabeza_dia', v, 'kg', 'diario', p, 'ARS', iva, 'Con silo de sorgo', '[script 307] ' || n
from (values
  (3, 'Silo de sorgo', 17.5,  0::numeric,   0::numeric, '910 kg/día del lote ÷ 52 cab (06/10). Del stock propio: sin compra'), 
  (4, 'Maíz',          5.29,  270,          10.5,       '275 kg/día del lote ÷ 52 cab (06/10)'), 
  (5, 'Núcleo',        1.25,  745,          21,         '65 kg/día del lote ÷ 52 cab (06/10); precio del concentrado')
) x(o, c, v, p, iva, n)
where not exists (select 1 from productivo.actividad_insumos where notas like '[script 307]%');

-- Y el PLAN DEL AÑO 26/27 de Engorde usa esa dieta (JMS 26/11: «este año ya estoy usando la que te comenté»). La receta no cambia.
insert into public.presupuesto_variables (empresa, escenario, campana, concepto, actividad_id, dieta, cantidad, precio, distribucion, fuente_cantidad, fuente_precio, fundamento, activo)
select 'MSA', 'base', '26/27', 'Dieta 26/27', '46650501-2eb8-487f-a401-0bc162143790', 'Con silo de sorgo', 0, 0, 'calendario', 'manual', 'manual', '[script 307] dieta del año dictada por JMS 26/11', true
where not exists (select 1 from public.presupuesto_variables where actividad_id = '46650501-2eb8-487f-a401-0bc162143790' and campana = '26/27' and dieta is not null);
