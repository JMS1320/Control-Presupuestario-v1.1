-- 302 DESHACER · las dos columnas las creó el 302 (no existían): se quitan con sus valores.
alter table productivo.actividad_insumos drop column if exists iva_pct;
alter table public.presupuesto_variables drop column if exists iva_pct;
update public.presupuesto_variables set unidad = 'rollos' where fundamento like '[script 301]%' and receta_insumo_id = 'bd16dd79-41ca-4d26-9ca1-64651bc70023';
