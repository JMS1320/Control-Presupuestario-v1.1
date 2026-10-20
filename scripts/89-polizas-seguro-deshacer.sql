-- 89 · DESHACER — Pólizas de seguro (A-FEAT-1309)
-- ⚠️ Borra las tablas de pólizas y TODO lo que se haya procesado en ellas. No toca ninguna otra tabla.
-- Correrlo sólo si se decide abandonar la faceta: lo procesado se pierde (los PDF siguen en Drive).

begin;
delete from public.recurso_tablas where schema_nombre = 'public'
  and tabla in ('polizas_seguro', 'polizas_endosos', 'polizas_cuotas', 'polizas_bienes', 'polizas_responsables');
drop table if exists public.polizas_bienes;
drop table if exists public.polizas_cuotas;
drop table if exists public.polizas_endosos;
drop table if exists public.polizas_seguro;
drop table if exists public.polizas_responsables;
commit;
notify pgrst, 'reload schema';
