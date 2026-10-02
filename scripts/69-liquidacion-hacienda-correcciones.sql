-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 69 · La HUELLA de la liquidación de hacienda                       A-FEAT-1225 · 2026-10-01
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- § 📄 de CLAUDE.md: «cada corrección deja HUELLA — lo que propuso el sistema junto a lo que puso
-- el usuario». Es la misma columna que ya tienen `productivo.romaneos.correcciones` y
-- `public.boletas_arba.correcciones`.
--
-- Guarda: los montos tipeados a mano (comisión, IVA) con lo que daba el %; las marcas
-- Coincide / Distinto contra el papel; y qué cambió el usuario de lo precargado desde la venta.
-- Forma: ver `HuellaLiq` en `lib/ventas/hacienda.ts`. Vacía (null) cuando no hubo nada que anotar.
--
-- SÓLO MSA, como el 68: MA y PAM no venden hacienda (decisión del usuario).
-- Pedido por el usuario el 2026-10-01 («sí» a guardar la huella).
-- 🔙 Deshacer: `scripts/69-liquidacion-hacienda-correcciones-deshacer.sql`.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

alter table msa.comprobantes_venta
  add column if not exists correcciones jsonb;

comment on column msa.comprobantes_venta.correcciones is
  'A-FEAT-1225 — HUELLA: {version, montosAMano{comision,iva:{calculado,tipeado}}, contraElPapel{bruto,neto,importe}, precarga{ventaId,cambios[]}}';

commit;

notify pgrst, 'reload schema';
