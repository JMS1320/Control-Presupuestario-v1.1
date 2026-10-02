-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 68 · La liquidación de HACIENDA entra a comprobantes_venta        A-FEAT-1225 · 2026-10-01
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- QUÉ ES
--   La «Cuenta de Venta y Líquido Producto» (tipo 60) que emite el consignatario. Va a la MISMA
--   tabla que la liquidación de granos y las facturas de venta, a propósito: así entra sola al
--   subdiario de ventas, al balance, a la conciliación y al Cash Flow. Una tabla aparte sería una
--   segunda verdad que nadie más mira.
--
-- QUÉ AGREGA — sólo lo que la de granos no tiene. Todo lo demás ya existe y se reusa:
--   fecha_liquidacion, nro_comprobante, cuit/denominacion_cliente (el consignatario), peso_kg,
--   precio_pesos, subtotal_neto (bruto), comision_neto, alicuota_iva, iva, ret_iibb,
--   imp_neto_gravado, imp_total, procedencia, estado, fecha_cobro_estimada.
--
--   cabezas          total de cabezas del papel
--   hacienda_lineas  la tabla del papel: comprador, CUIT, cabezas, clasificación, kilos, precio
--   redondeo         el «Ajuste por redondeo», con su signo, copiado del papel
--   nro_guia, dte    la guía y el documento de tránsito
--   plazos           las cuotas de cobro: días, %, vencimiento, importe
--
-- EN LAS TRES EMPRESAS, aunque hoy sólo MSA vende hacienda: las tres comprobantes_venta son
-- idénticas (53 columnas, medido 2026-10-01) y conviene que lo sigan siendo. Son columnas que
-- aceptan vacío: no tocan ninguna fila existente ni ninguna pantalla.
--
-- ✅ Verificado antes de escribir esto: ninguna vista de `public` está armada sobre
--   comprobantes_venta (las 13 que hay no la usan), y la app escribe en la TABLA
--   (`schema('msa').from('comprobantes_venta')`), no en una vista — la trampa de A-BUG-1229 no
--   aplica acá.
-- 🔙 Se deshace con `scripts/68-liquidacion-hacienda-deshacer.sql`.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

alter table msa.comprobantes_venta
  add column if not exists cabezas         numeric,
  add column if not exists hacienda_lineas jsonb,
  add column if not exists redondeo        numeric,
  add column if not exists nro_guia        text,
  add column if not exists dte             text,
  add column if not exists plazos          jsonb;

alter table pam.comprobantes_venta
  add column if not exists cabezas         numeric,
  add column if not exists hacienda_lineas jsonb,
  add column if not exists redondeo        numeric,
  add column if not exists nro_guia        text,
  add column if not exists dte             text,
  add column if not exists plazos          jsonb;

alter table ma.comprobantes_venta
  add column if not exists cabezas         numeric,
  add column if not exists hacienda_lineas jsonb,
  add column if not exists redondeo        numeric,
  add column if not exists nro_guia        text,
  add column if not exists dte             text,
  add column if not exists plazos          jsonb;

comment on column msa.comprobantes_venta.hacienda_lineas is
  'A-FEAT-1225 — líneas de la Cuenta de Venta y Líquido Producto: [{razonSocial, cuit, cabezas, clasificacion, kilos, precio}]';
comment on column msa.comprobantes_venta.plazos is
  'A-FEAT-1225 — cuotas de cobro: [{dias, pct, vencimiento, importe}]. Suman el importe neto.';

commit;

-- ── Control (sólo lectura) ───────────────────────────────────────────────────────────────────
-- Las tres tablas tienen que seguir idénticas: 59 columnas cada una.
-- select table_schema, count(*) from information_schema.columns
--  where table_name = 'comprobantes_venta' and table_schema in ('msa','pam','ma') group by 1;
