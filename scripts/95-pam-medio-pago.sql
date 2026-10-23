-- 95 · «PAGADO DESDE» en las facturas de PAM (A-FEAT-1321, usuario 2026-10-23)
--
-- «A veces cuando hago un pago lo hago directamente de la cuenta de MA y hoy no queda registrado…
-- miro el banco de MSA y no está pagado y puedo desconfiar.»
--
-- La app guarda de qué cuenta salió un pago en `medio_pago` (ya existía: banco / caja) y ahora acepta
-- también una cuenta bancaria puntual (msa_galicia, pam_galicia, pam_galicia_cc, ma_galicia).
-- Las cuotas de templates y las facturas de MSA y MA ya tienen la columna; las de PAM NO.
-- Sin este script, marcar «pagado desde» en una factura de PAM falla (la app avisa y no guarda).
--
-- Aditivo: columna nueva, vacía = «banco de la propia empresa». No toca ninguna fila.
-- Las facturas se escriben directo en el schema (no hay vista public.* en el medio).
-- Deshacer: 95-pam-medio-pago-deshacer.sql

alter table pam.comprobantes_arca add column if not exists medio_pago text;

comment on column pam.comprobantes_arca.medio_pago is
  'De qué cuenta salió el pago: banco (o vacío) = la de la empresa; o msa_galicia / pam_galicia / pam_galicia_cc / ma_galicia / caja_*. A-FEAT-1321';

-- Verificación (sin escribir datos): tiene que planear sin error.
-- explain update pam.comprobantes_arca set medio_pago = 'ma_galicia' where false;
