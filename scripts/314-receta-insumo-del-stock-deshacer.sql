-- Deshace el [script 314]. La columna no existía antes (verificado 27/11).
begin;
alter table productivo.actividad_insumos drop column if exists insumo_stock_id;
commit;
