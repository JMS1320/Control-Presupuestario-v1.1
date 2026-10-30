-- Deshacer del script 141: saca la columna `vinculo` de public.cuadernos (y su índice).
-- Seguro: el 141 se niega a correr si la columna ya existía, así que esta columna es la que creó él.
-- ⚠️ Los cuadernos que se hayan atado a un tema quedan sueltos (su contenido no se toca).
begin;
drop index if exists public.cuadernos_vinculo;
alter table public.cuadernos drop column if exists vinculo;
commit;
notify pgrst, 'reload schema';
