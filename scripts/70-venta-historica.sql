-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 70 · La venta de hacienda HISTÓRICA — sin movimiento de stock, a propósito     A-FEAT-1226 · 2026-10-02
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Pedido del usuario 2026-10-02 («sí, agregá la columna y hacé lo de la venta histórica»), para la
-- venta del 27/01/2026 (70 novillos, Frig. Rioplatense): la app arranca en febrero, así que esa
-- hacienda no está en el stock y la venta no puede descontarla.
--
-- Una venta SIN su movimiento de stock, si no dice por qué, parece un error: el día que se arme un
-- control de stock la va a marcar como faltante. Esta columna dice por qué.
--
-- Va en la MISMA tabla que el resto de las ventas de hacienda: regla del usuario, «no podemos crear
-- dos fuentes de almacenamiento paralelas y desvinculadas».
--
-- Medido antes de escribir esto, quién lee `stock_ventas` y qué le pasa a una histórica (sin lote):
--   · margen, ventas por lote, lotes, romaneo, mediciones, presupuesto → filtran por lote o por
--     carga: no la toman, que es lo correcto.
--   · Ventas, Cash Flow y vínculo con facturas (vía `ventas_unificadas`) → SÍ la ven: la vista ya
--     resuelve la categoría por `categoria_id` cuando no hay lote. Mientras no tenga su liquidación
--     figura «a cobrar», como cualquier venta; al liquidarla deja de contar ahí (la muestra la
--     liquidación). La vista NO se toca.
-- 🔙 Deshacer: `scripts/70-venta-historica-deshacer.sql` (con freno si ya hay históricas).
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

alter table productivo.stock_ventas
  add column if not exists historica boolean not null default false;

comment on column productivo.stock_ventas.historica is
  'A-FEAT-1226 — venta anterior al stock de la app: se guarda SIN movimiento de stock, a propósito. El usuario lo confirma al cargarla.';

commit;

notify pgrst, 'reload schema';
