-- [script 314] ESTRUCTURA — qué insumo del STOCK usa cada renglón de la receta (A-FEAT-1663 stock paso 2; JMS 27/11: «dale, seguí hasta terminarlo»).
-- Hasta acá la receta y el stock se unían por el nombre (D5 del diagnóstico 26/11: hay dos concentrados en stock).
-- Sólo AGREGA una columna (verificado 27/11: no existía). Aviso previo en ENTRE-DESARROLLADORES.md. Sin RLS ni permisos nuevos.
-- Deshacer: scripts/314-receta-insumo-del-stock-deshacer.sql
begin;
alter table productivo.actividad_insumos
  add column if not exists insumo_stock_id uuid references productivo.stock_insumos(id) on delete set null;
commit;
