-- 301 DESHACER · vuelve cada renglón de la receta de Cría a sus valores del 25/11 (foto tomada antes de correr el 301)
-- y borra sólo lo que creó el 301 (marcados «[script 301]»).
update productivo.actividad_insumos set modo = 'monto_cabeza', valor = 21.6667, moneda = 'USD', base_cabezas = 'rodeo', unidad = 'U$S/rollo', meses_pct = null, fundamento = null, updated_at = now()
where id = 'bd16dd79-41ca-4d26-9ca1-64651bc70023';
update productivo.actividad_insumos set meses_pct = null, fundamento = null, updated_at = now() where id = '793f2419-9999-438e-88a9-53c50e8e7d7d';
update productivo.actividad_insumos set has_aplicacion = 15, fundamento = null, updated_at = now() where id = 'bfeff03c-0490-441f-ab05-f7c341d3dff0';
update productivo.actividad_insumos set valor = 0, has_aplicacion = null, meses_pct = null, fundamento = null, updated_at = now() where id = '91fb4601-7912-41cd-b31e-9298a3c1ce04';
update productivo.actividad_insumos set modo = 'monto_ha', cantidad_aplicacion = null, valor = 0, moneda = 'USD', unidad = 'U$S/ha', meses_pct = null, fundamento = null, updated_at = now()
where id = '2df8656c-331a-493e-b67e-487cb32dcec0';
update productivo.actividades set racion_pct_pv = 0, updated_at = now() where id = '7dbf0185-5e25-4980-8dc4-0d3941c12fc6';
delete from public.presupuesto_marcas where origen_tabla = 'actividad_insumos' and detalle like '[script 301]%';
delete from public.presupuesto_variables where fundamento like '[script 301]%';
