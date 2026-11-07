-- Deshace el 233: la columna la creó el 233 (verificó que no existía). Se pierden los links que se hayan vinculado desde entonces.
begin;
alter table msa.comprobantes_venta drop column if exists pdf_drive_url;
alter table pam.comprobantes_venta drop column if exists pdf_drive_url;
alter table ma.comprobantes_venta  drop column if exists pdf_drive_url;
commit;
