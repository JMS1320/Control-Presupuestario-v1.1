-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 91 · Consumos en USD: la cuota guarda los dólares y el TC                  A-FEAT-1312 · 2026-10-20
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Pedido del usuario 2026-10-20: *«no diría que se conviertan en pesos en el extracto sino en el
-- template con una nueva columna de TC, para que se vea que son montos originales en dólares»*.
-- El extracto de la tarjeta queda como el papel del banco (en USD); la cuota guarda el original en
-- dólares y el cambio del pago, y su `monto` en pesos = monto_usd × tipo_cambio.
--
-- ADITIVO: dos columnas nullable. No toca filas, RLS, roles ni GRANTs. `cuotas_egresos_sin_factura`
-- es tabla de `public` y ninguna vista la lista por columnas (verificado en view_table_usage).
-- ⚠️ Aviso a Javier en ENTRE-DESARROLLADORES.md (2026-10-20). Se corre con JMS presente.
-- Revert: scripts/91-cuotas-usd-tc-deshacer.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
begin;

alter table public.cuotas_egresos_sin_factura
  add column if not exists monto_usd numeric(15,2),
  add column if not exists tipo_cambio numeric(15,4);

comment on column public.cuotas_egresos_sin_factura.monto_usd is
  'A-FEAT-1312: importe original en dólares (consumo USD de la tarjeta). Null = cuota en pesos.';
comment on column public.cuotas_egresos_sin_factura.tipo_cambio is
  'A-FEAT-1312: cambio real del pago (débito en pesos ÷ SU PAGO EN USD). monto = monto_usd × tipo_cambio.';

commit;
notify pgrst, 'reload schema';

-- Verificación (sin escribir): tiene que planear sin error.
-- explain update public.cuotas_egresos_sin_factura set monto_usd = 1, tipo_cambio = 1 where false;
