-- Deshace el [script 323]. La tabla no existía antes (verificado 27/11).
begin;
delete from public.recurso_tablas where schema_nombre = 'public' and tabla = 'presupuesto_fotos' and motivo like '[script 323]%';
drop table if exists public.presupuesto_fotos;
commit;
