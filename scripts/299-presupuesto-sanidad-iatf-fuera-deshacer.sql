-- 299 DESHACER · saca sólo las 4 marcas que creó el 299 (por su detalle «[script 299]»).
delete from public.presupuesto_marcas where origen_tabla = 'actividad_insumos' and marca = 'fuera' and detalle like '[script 299]%';
