-- Deshace el [script 319]. Las 3 columnas no existían antes (verificado 27/11).
-- ⚠️ Borra antes las filas de plan POR LOTE (si no, quedarían como plan de la actividad para todos los lotes).
begin;
delete from public.presupuesto_variables where lote_id is not null;
drop index if exists public.presupuesto_variables_lote;
alter table public.presupuesto_variables drop column if exists lote_id, drop column if exists fecha_desde, drop column if exists fecha_hasta;
commit;
