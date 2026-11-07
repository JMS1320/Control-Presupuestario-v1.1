-- 231 · BIENES DE PAM A MA DESDE EL 01/01/2026, sólo CONTABLE (DATOS) — A-FEAT-1577 punto 12. OK JMS 07/11: «desde 1/1/26 es MA… hacé un backup antes».
-- Las partidas de PAM (inmobiliario, Red Vial) y Posadas son de MA desde el 01/01/2026, salvo El Relincho y Quinta Rosello: si pagó MSA, CTA PAM → CTA MA;
-- si pagó PAM, vacío → DIST MA. Regla: lib/balance/dueno-de-bienes.ts. Control: scripts/control-bienes-pam-a-ma.mts. Backup: scripts/231-foto-antes.json.
-- 17 movimientos. Cada update exige que la columna siga diciendo lo leído. Deshacer: 231-bienes-pam-a-ma-deshacer.sql.
begin;
update public.pam_galicia_cc set contable = 'DIST MA' where id = '405f97dc-8850-4663-b6ee-434c50e64199' and contable is not distinct from null;
update public.msa_galicia set contable = 'CTA MA' where id = '37d9226a-a5be-4b93-93c9-8d19470b1dff' and contable is not distinct from 'CTA PAM';
update public.pam_galicia_cc set contable = 'DIST MA' where id = '8dc9ae68-ee58-42a0-8917-2c9966593d88' and contable is not distinct from null;
update public.msa_galicia set contable = 'CTA MA' where id = 'f2a9c499-61bb-4d12-bfcb-ae098f18b8a0' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = 'bf164ee4-56a6-4908-ba9e-190732a23efe' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = '43deb49b-6e61-4584-9918-0d17e0697f20' and contable is not distinct from 'CTA PAM';
update public.pam_galicia_cc set contable = 'DIST MA' where id = '0ade66fd-fd65-4e72-a229-602efa1b97d9' and contable is not distinct from null;
update public.pam_galicia_cc set contable = 'DIST MA' where id = '0cbfa831-8faf-4379-aa98-ca36a952a4c2' and contable is not distinct from null;
update public.msa_galicia set contable = 'CTA MA' where id = 'd23ca29c-677f-4b75-8e65-f308848becbd' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = 'ad665e2a-ff81-4079-b8fa-dd1c12d62b9a' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = '1eca9287-faaf-4654-a223-521015a9aaa9' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = '01074b5a-0961-4b15-845d-5e6f0e26f877' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = '52b7af75-a4bb-405e-90b3-2421ab091f91' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = '831a4e68-8cac-4185-9e20-b06cd0cbdea3' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = 'cb32e254-2cc4-4b70-9427-73afe9e215e2' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = 'd5d82c02-ff77-44aa-b3fd-370352d4fa50' and contable is not distinct from 'CTA PAM';
update public.msa_galicia set contable = 'CTA MA' where id = '1243bbd4-f0e7-473e-8650-12d8018b7266' and contable is not distinct from 'CTA PAM';
-- Corrección al correr (07/11): estas 2 tenían contable = '' (texto vacío, no null) y la condición de arriba no las tomó; se aplicaron así:
update public.pam_galicia_cc set contable = 'DIST MA' where id in ('0ade66fd-fd65-4e72-a229-602efa1b97d9','0cbfa831-8faf-4379-aa98-ca36a952a4c2') and contable = '';
commit;
