-- 243 · Wilson Barreto: el adelanto de $ 200.000 se vincula al pago real (Caja Sigot 21/02/26) y se suelta de la extracción de MA (DATOS) — DR3 + DR9.
-- OK JMS 10/11 («B ok»): la extracción de MA CA del 19/02 es MA pasando plata a su propia caja → sin Wilson y sin código contable (tenía «CTA MSA»).
-- La fecha del adelanto en Sueldos (16/03) NO se toca: queda a confirmar. Foto: scripts/243-foto-antes.json · Deshacer: 243-…-deshacer.sql.
begin;
update ma.ma_galicia set sueldo_pago_id = null, contable = null
 where id = '957f32e6-70c4-486e-a1a0-8f047880447e' and sueldo_pago_id = '778817c5-a588-4cea-9e7b-aa0a99807c5e';
update msa.caja_sigot set sueldo_pago_id = '778817c5-a588-4cea-9e7b-aa0a99807c5e'
 where id = '484e6ccb-90dd-4d8a-9ec5-50ac648225f4' and sueldo_pago_id is null;
commit;
