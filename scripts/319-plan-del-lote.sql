-- [script 319] ESTRUCTURA — el PLAN DEL AÑO del LOTE: cada renglón de la ración con su fecha, por lote (A-FEAT-1670; JMS 27/11: «a, por lote. dale, desarrollalo»).
-- Una fila de public.presupuesto_variables con lote_id + receta_insumo_id + campana pisa ESE renglón sólo para ESE lote (cuándo come, cuánto, precio).
-- Sólo AGREGA columnas (verificado 27/11: no existían). Aviso previo en ENTRE-DESARROLLADORES.md. Sin RLS ni permisos nuevos (la tabla ya los tiene).
-- Deshacer: scripts/319-plan-del-lote-deshacer.sql
begin;
alter table public.presupuesto_variables
  add column if not exists lote_id uuid references productivo.stock_lotes(id) on delete cascade,
  add column if not exists fecha_desde date,
  add column if not exists fecha_hasta date;
create index if not exists presupuesto_variables_lote on public.presupuesto_variables (lote_id) where lote_id is not null;
commit;
