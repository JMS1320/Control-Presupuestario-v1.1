-- Deshace el 243 (por id, a la foto).
begin;
update msa.caja_sigot set sueldo_pago_id = null where id = '484e6ccb-90dd-4d8a-9ec5-50ac648225f4' and sueldo_pago_id = '778817c5-a588-4cea-9e7b-aa0a99807c5e';
update ma.ma_galicia set sueldo_pago_id = '778817c5-a588-4cea-9e7b-aa0a99807c5e', contable = 'CTA MSA' where id = '957f32e6-70c4-486e-a1a0-8f047880447e' and sueldo_pago_id is null;
commit;
