alter table productivo.actividad_insumos drop column if exists dieta;
alter table productivo.actividades drop column if exists dieta_default;
alter table public.presupuesto_variables drop column if exists dieta;
