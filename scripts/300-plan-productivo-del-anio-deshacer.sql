-- 300 DESHACER · las tres columnas las creó el 300 (ADD COLUMN sin IF NOT EXISTS: no existían).
alter table public.presupuesto_variables drop column if exists moneda;
alter table public.presupuesto_variables drop column if exists actividad_id;
alter table public.presupuesto_variables drop column if exists receta_insumo_id;
