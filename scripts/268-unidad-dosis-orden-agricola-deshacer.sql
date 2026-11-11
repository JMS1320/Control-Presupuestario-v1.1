-- Deshace [script 268]. ⚠️ Sólo si no quedaron filas con otra unidad (kg, g…) o más de 5 letras: si las hay, fallaría.
-- select unidad_dosis, count(*) from productivo.lineas_orden_agricola where unidad_dosis not in ('L','cc') group by 1;
alter table productivo.lineas_orden_agricola drop constraint lineas_orden_agricola_unidad_dosis_check;
alter table productivo.lineas_orden_agricola alter column unidad_dosis type varchar(5);
alter table productivo.lineas_orden_agricola add constraint lineas_orden_agricola_unidad_dosis_check check (unidad_dosis in ('L','cc'));
