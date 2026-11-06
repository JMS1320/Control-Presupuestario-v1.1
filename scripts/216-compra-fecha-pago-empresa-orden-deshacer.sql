-- Deshacer del script 216 (las columnas no existían antes: el 216 lo verifica)
alter table productivo.movimientos_insumos
  drop column if exists compra_id, drop column if exists fecha_pago, drop column if exists empresa, drop column if exists orden_agricola_id;
