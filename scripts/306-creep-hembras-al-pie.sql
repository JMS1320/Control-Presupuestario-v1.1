-- 306 · A-FEAT-1665 (JMS 26/11: «el creep tiene que ser sobre todos los terneros al pie» · «para el lote de hembras, sí»)
-- DATOS. El lote «Ternera al Pie» 26/27 (31f52071…) no tenía período de Cría → sus terneras (y las 67 retenidas, que la grilla
-- suma a este lote antes del destete) no comían creep. Se le da el mismo período y el mismo nacimiento que al lote de machos.
-- Antes de correr (verificado 26/11): el lote tiene 0 períodos y fecha_nacimiento / peso_nacimiento_kg en NULL.
insert into productivo.lote_tramos (lote_id, actividad_id, orden, fecha_desde, fecha_hasta, notas)
select '31f52071-c18e-4925-826a-31ecf8ab64c6', '7dbf0185-5e25-4980-8dc4-0d3941c12fc6', 1, '2026-11-01', '2027-02-28',
       '[script 306] creep de las terneras al pie (incluye las retenidas), igual que los machos'
where not exists (select 1 from productivo.lote_tramos where lote_id = '31f52071-c18e-4925-826a-31ecf8ab64c6');

update productivo.stock_lotes set fecha_nacimiento = '2026-07-01', peso_nacimiento_kg = 30, updated_at = now()
where id = '31f52071-c18e-4925-826a-31ecf8ab64c6' and fecha_nacimiento is null and peso_nacimiento_kg is null;
