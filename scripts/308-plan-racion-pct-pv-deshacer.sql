-- Deshacer del 308: la columna la creó este script (no existía antes, verificado 26/11).
alter table public.presupuesto_variables drop column if exists racion_pct_pv;
