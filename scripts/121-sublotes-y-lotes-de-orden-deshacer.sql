-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- ↩️ Deshacer del script 121 (A-FEAT-1397 etapa 2)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Borra SÓLO lo que creó el 121: la tabla productivo.ordenes_agricolas_lotes (nueva: el 121 frena si ya existía),
-- la columna lotes_agricolas.lote_padre_id (ídem) y su fila en recurso_tablas (marcada [script 121]).
-- ⚠️ Lo que se haya cargado DESPUÉS desde la pantalla (sub-lotes, lotes de órdenes nuevas) se pierde con la tabla y la
-- columna; las órdenes siguen teniendo su texto de lotes y su total, así que la lista no pierde nada visible.
-- Antes de correrlo, volver la pantalla a la versión sin etapa 2 (si no, la carga de órdenes falla).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

drop table if exists productivo.ordenes_agricolas_lotes;
alter table productivo.lotes_agricolas drop constraint if exists lotes_agricolas_padre_distinto;
alter table productivo.lotes_agricolas drop column if exists lote_padre_id;
delete from public.recurso_tablas
 where schema_nombre = 'productivo' and tabla = 'ordenes_agricolas_lotes' and motivo like '[script 121]%';

commit;
