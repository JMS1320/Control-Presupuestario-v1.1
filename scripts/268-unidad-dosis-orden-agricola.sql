-- [script 268] A-BUG-1613 (OK de JMS 11/11: «sí, corré el 268»): la orden agrícola no guardaba dosis en kg/ha o g/ha.
-- La pantalla (A-BUG-1238, 05/11) ofrece L, cc, kg, g y la unidad del insumo; el CHECK seguía en 'L','cc' y la columna en
-- varchar(5). Antes: CHECK (unidad_dosis IN ('L','cc')), varchar(5). Sin vistas dependientes (verificado). No cambia datos.
alter table productivo.lineas_orden_agricola drop constraint lineas_orden_agricola_unidad_dosis_check;
alter table productivo.lineas_orden_agricola alter column unidad_dosis type varchar(20);
alter table productivo.lineas_orden_agricola add constraint lineas_orden_agricola_unidad_dosis_check check (btrim(unidad_dosis) <> '');
