-- Deshace el [script 322]. La tabla no existía antes (verificado 27/11).
begin;
delete from public.recurso_tablas where schema_nombre = 'productivo' and tabla = 'lote_ventas_plan' and motivo like '[script 322]%';
drop table if exists productivo.lote_ventas_plan;
commit;
