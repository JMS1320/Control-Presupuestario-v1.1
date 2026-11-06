-- Deshacer del script 221 (las columnas no existían antes: el 221 lo verifica)
alter table productivo.lineas_orden_agricola_labores drop column if exists tarifa, drop column if exists tarifa_unidad;
alter table productivo.ordenes_agricolas drop column if exists factura_contratista_id, drop column if exists factura_contratista_empresa;
