-- Deshace el script 87 (A-FEAT-1293). Las reglas que tenían template elegido vuelven a ir por su `categ`
-- (que se guarda igual al elegir el template), así que no se pierde la imputación.
begin;
alter table public.reglas_conciliacion drop column if exists template_id;
commit;
notify pgrst, 'reload schema';
