-- Deshace 98. La columna NO existía antes del script (verificado 2026-10-24), así que borrarla sólo
-- quita lo que creó el 98 — incluidos los valores que se le hayan cargado después.
alter table public.proveedores drop column if exists facturas_por_mes;
