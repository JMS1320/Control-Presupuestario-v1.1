-- Deshace el [script 316].
begin;
delete from productivo.mediciones_insumo where insumo_stock_id = '8289c48d-be7e-4933-b4a5-5149141ea1d8' and notas like '[script 316]%';
delete from productivo.consumo_declarado_insumo where insumo_stock_id = '8289c48d-be7e-4933-b4a5-5149141ea1d8' and notas like '[script 316]%';
delete from productivo.stock_inicio where insumo_stock_id = '8289c48d-be7e-4933-b4a5-5149141ea1d8' and fecha = '2026-06-30' and fuente like '[script 316]%';
update productivo.actividad_insumos set insumo_stock_id = null where id = 'ee02f97e-ec04-40d6-be8d-ff58f633f71b';
update productivo.stock_insumos set unidad_medida = 't' where id = '8289c48d-be7e-4933-b4a5-5149141ea1d8';
commit;
