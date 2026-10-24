-- Deshace 96-partidas-hectareas.sql: borra SÓLO las partidas que cargó ese script (marca en observaciones).
-- ⚠️ Si después se les colgaron filas (partidas_anio, partidas_centro_costo, partidas_titularidad), mirarlas antes.
delete from public.partidas where observaciones like '%[script 96]%';
