-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 77 · EL PAGO DE LA TARJETA ATADO A SU RESUMEN                         A-DEC-1002 · 2026-10-03
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Pedido del usuario: emparejar la tarjeta con el extracto de cuenta corriente — el débito
-- «Pago Visa Empresa» tiene que quedar vinculado AL RESUMEN que paga, y si hay diferencias, avisar.
--
-- Una columna en los extractos bancarios: `nro_resumen` — el mismo nombre y formato que ya tienen
-- las tablas de tarjeta (`msa.tarjeta_visa_business`, `pam.tarjeta_visa`, `ma.tarjeta_visa`). Un
-- débito con `nro_resumen` es el pago de ese resumen (puede haber más de uno: pesos y dólares).
-- Así el control «total del resumen = débito en cuenta corriente = SU PAGO del siguiente» se arma
-- por un vínculo y no por coincidencia de importes.
--
-- No toca RLS ni permisos: es una columna más en tablas que ya los tienen. Avisado a Javier ANTES.
-- 🔙 Deshacer: `scripts/77-pago-de-resumen-tarjeta-deshacer.sql`.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;
alter table public.msa_galicia    add column if not exists nro_resumen varchar(30);
alter table public.pam_galicia    add column if not exists nro_resumen varchar(30);
alter table public.pam_galicia_cc add column if not exists nro_resumen varchar(30);
alter table ma.ma_galicia         add column if not exists nro_resumen varchar(30);

comment on column public.msa_galicia.nro_resumen is
  'A-DEC-1002 — si este débito es el pago de un resumen de tarjeta, su nro_resumen (el de la tabla de la tarjeta).';
commit;

notify pgrst, 'reload schema';
