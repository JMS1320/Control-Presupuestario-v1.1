-- Deshace el 78. ⚠️ Pierde la moneda y el precio original de las compras que se hayan marcado en USD.
alter table productivo.movimientos_insumos drop constraint if exists movimientos_insumos_moneda_chk;
alter table productivo.movimientos_insumos
  drop column if exists moneda,
  drop column if exists costo_unitario_moneda,
  drop column if exists tipo_cambio;
