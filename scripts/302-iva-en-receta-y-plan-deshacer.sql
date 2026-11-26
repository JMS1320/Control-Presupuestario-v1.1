-- 302 DESHACER · las dos columnas las creó el 302 (no existían): se quitan con sus valores.
alter table productivo.actividad_insumos drop column if exists iva_pct;
alter table public.presupuesto_variables drop column if exists iva_pct;
