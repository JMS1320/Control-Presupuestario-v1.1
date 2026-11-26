-- Deshacer del 306: borra SÓLO el período que creó (marcado [script 306]) y vuelve a NULL el nacimiento del lote (era NULL antes).
delete from productivo.lote_tramos where lote_id = '31f52071-c18e-4925-826a-31ecf8ab64c6' and notas like '[script 306]%';
update productivo.stock_lotes set fecha_nacimiento = null, peso_nacimiento_kg = null, updated_at = now()
where id = '31f52071-c18e-4925-826a-31ecf8ab64c6' and fecha_nacimiento = '2026-07-01' and peso_nacimiento_kg = 30;
