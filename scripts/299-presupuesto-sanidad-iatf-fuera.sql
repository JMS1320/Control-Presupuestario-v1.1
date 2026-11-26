-- 299 · A-FEAT-1663 C1/Q7 — los renglones de SANIDAD e IATF de la receta de Cría quedan FUERA DEL PRESUPUESTO (no se borran)
-- JMS 25/11: «mientras la sanidad queda en suspenso… hay que desactivarlos. Que no se borren… e IATF lo mismo… porque están las
-- cuentas activas». Las cuentas 42301 (honorarios veterinario), 42307 (insumos veterinarios) y 42316 (IATF) siguen presupuestando
-- por cabeza; sin esto la grilla lo contaba dos veces. Sólo el presupuesto: la RECETA no cambia y el MARGEN no se toca.
-- Marca 'fuera' en presupuesto_marcas (origen_tabla 'actividad_insumos', fila_id = el renglón). DATOS. Deshacer: 299-…-deshacer.sql
insert into public.presupuesto_marcas (empresa, origen_tabla, fila_id, origen, marca, detalle, marcado_por)
values
  ('MSA', 'actividad_insumos', 'cf3958e9-cce5-4018-809e-3e32da81ad6f', 'RECETA', 'fuera', '[script 299] Cría · Sanidad Vacas — va por la cuenta 42301/42307', 'Claude (OK de JMS 25/11)'),
  ('MSA', 'actividad_insumos', '6e1ad444-7913-4b36-9867-7daadd0d9d61', 'RECETA', 'fuera', '[script 299] Cría · Sanidad Toros — va por la cuenta 42301/42307', 'Claude (OK de JMS 25/11)'),
  ('MSA', 'actividad_insumos', 'd3ee7fba-59bb-47c6-9ac9-fd53d63d5903', 'RECETA', 'fuera', '[script 299] Cría · Sanidad Terneros hasta destete — va por la cuenta 42301/42307', 'Claude (OK de JMS 25/11)'),
  ('MSA', 'actividad_insumos', '53743bff-b2f1-46c2-9ef4-62f0b916920d', 'RECETA', 'fuera', '[script 299] Cría · IATF Vacas — va por la cuenta 42316', 'Claude (OK de JMS 25/11)')
on conflict (empresa, origen_tabla, fila_id) do nothing;
