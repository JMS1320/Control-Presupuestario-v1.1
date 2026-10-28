-- ↩️ Deshacer del script 124 (A-FEAT-1410). Borra la tabla public.cuadernos, que el 124 creó nueva (frena si ya
-- existía). ⚠️ Se pierden los cuadernos escritos después: bajarlos a Excel antes si sirven.
begin;
drop table if exists public.cuadernos;
commit;
