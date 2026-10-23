-- Deshace 95-pam-medio-pago.sql. ⚠️ Borra lo que se haya marcado como «pagado desde» en facturas de PAM.
alter table pam.comprobantes_arca drop column if exists medio_pago;
