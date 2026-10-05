-- 78 · Moneda de las compras de insumos — A-BUG-1244 (2026-10-05)
--
-- Motivo: toda la app lee `productivo.movimientos_insumos.costo_unitario` como PESOS (consumo, margen
-- y el stock valuado del balance — lib/balance/stock-insumos.ts). Las compras en dólares (Agro Centros,
-- 30/09/2026) se cargaron en dólares en ese campo, y el stock quedaba valuado 1.522 veces de menos.
--
-- Decisión del usuario: la compra se carga en su moneda; el TC se pone al vincular la factura (el
-- control). `costo_unitario` SIGUE EN PESOS — nada de lo que ya lo lee cambia —, y al lado queda el
-- original:
--   moneda                  'ARS' | 'USD'  (default 'ARS': todo lo cargado hasta hoy era en pesos…
--                                           salvo lo que el usuario marque a mano como USD)
--   costo_unitario_moneda   el precio en esa moneda (en ARS, igual a costo_unitario)
--   tipo_cambio             el TC con que se pasó a pesos (NULL en ARS)
--
-- No toca ningún dato existente. Sin vistas que reescribir (la tabla se expone directa en `productivo`).

alter table productivo.movimientos_insumos
  add column if not exists moneda text not null default 'ARS',
  add column if not exists costo_unitario_moneda numeric,
  add column if not exists tipo_cambio numeric;

alter table productivo.movimientos_insumos
  drop constraint if exists movimientos_insumos_moneda_chk;
alter table productivo.movimientos_insumos
  add constraint movimientos_insumos_moneda_chk check (moneda in ('ARS', 'USD'));

comment on column productivo.movimientos_insumos.moneda is 'Moneda en que se compró (A-BUG-1244). costo_unitario sigue siempre en pesos.';
comment on column productivo.movimientos_insumos.costo_unitario_moneda is 'Precio unitario en la moneda de compra (el pactado o el de la factura).';
comment on column productivo.movimientos_insumos.tipo_cambio is 'TC con que costo_unitario_moneda se pasó a pesos (se carga al vincular la factura).';
