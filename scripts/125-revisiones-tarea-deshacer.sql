-- ↩️ Deshacer del script 125 (A-FEAT-1411): borra las 2 columnas que el 125 creó (frena si ya existían).
-- Antes, volver la pantalla a la versión sin tareas.
begin;
alter table public.revisiones drop column if exists es_tarea, drop column if exists tarea_hasta;
commit;
