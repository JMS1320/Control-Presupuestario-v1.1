-- Deshace scripts/81-planilla-asistencia.sql (A-FEAT-1259). ⚠️ Borra las marcas de asistencia cargadas y los feriados.
begin;
drop view if exists public.sueldos_asistencia;
drop table if exists sueldos.asistencia;
drop table if exists public.feriados;
commit;
notify pgrst, 'reload schema';
