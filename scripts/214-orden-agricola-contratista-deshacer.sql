-- Deshacer del script 214 (las columnas no existían antes: el 214 lo verifica)
alter table productivo.ordenes_agricolas drop column if exists contratista_cuit, drop column if exists contratista_nombre;
