-- Deshace el 231 (cada movimiento vuelve a su contable anterior, sólo si todavía tiene el que puso el 231).
begin;
update public.pam_galicia_cc set contable = null where id = '405f97dc-8850-4663-b6ee-434c50e64199' and contable is not distinct from 'DIST MA';
update public.msa_galicia set contable = 'CTA PAM' where id = '37d9226a-a5be-4b93-93c9-8d19470b1dff' and contable is not distinct from 'CTA MA';
update public.pam_galicia_cc set contable = null where id = '8dc9ae68-ee58-42a0-8917-2c9966593d88' and contable is not distinct from 'DIST MA';
update public.msa_galicia set contable = 'CTA PAM' where id = 'f2a9c499-61bb-4d12-bfcb-ae098f18b8a0' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = 'bf164ee4-56a6-4908-ba9e-190732a23efe' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = '43deb49b-6e61-4584-9918-0d17e0697f20' and contable is not distinct from 'CTA MA';
update public.pam_galicia_cc set contable = null where id = '0ade66fd-fd65-4e72-a229-602efa1b97d9' and contable is not distinct from 'DIST MA';
update public.pam_galicia_cc set contable = null where id = '0cbfa831-8faf-4379-aa98-ca36a952a4c2' and contable is not distinct from 'DIST MA';
update public.msa_galicia set contable = 'CTA PAM' where id = 'd23ca29c-677f-4b75-8e65-f308848becbd' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = 'ad665e2a-ff81-4079-b8fa-dd1c12d62b9a' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = '1eca9287-faaf-4654-a223-521015a9aaa9' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = '01074b5a-0961-4b15-845d-5e6f0e26f877' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = '52b7af75-a4bb-405e-90b3-2421ab091f91' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = '831a4e68-8cac-4185-9e20-b06cd0cbdea3' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = 'cb32e254-2cc4-4b70-9427-73afe9e215e2' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = 'd5d82c02-ff77-44aa-b3fd-370352d4fa50' and contable is not distinct from 'CTA MA';
update public.msa_galicia set contable = 'CTA PAM' where id = '1243bbd4-f0e7-473e-8650-12d8018b7266' and contable is not distinct from 'CTA MA';
-- Las 2 de PAM CC que tenían '' (texto vacío) vuelven a ''
update public.pam_galicia_cc set contable = '' where id in ('0ade66fd-fd65-4e72-a229-602efa1b97d9','0cbfa831-8faf-4379-aa98-ca36a952a4c2') and contable = 'DIST MA';
commit;
