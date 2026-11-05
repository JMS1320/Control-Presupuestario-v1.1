-- ↩️ Deshacer del script 202. La columna NO existía antes del 202 (verificado el 05/11), así que borrarla sólo borra lo
-- que creó ese script y las asignaciones que se hayan hecho después desde Configuración.
-- ⚠️ Mirar antes qué se pierde:
--     select nombre_referencia, año, avisar_a from public.egresos_sin_factura where cardinality(avisar_a) > 0;
begin;
alter table public.egresos_sin_factura drop column if exists avisar_a;
commit;
notify pgrst, 'reload schema';
