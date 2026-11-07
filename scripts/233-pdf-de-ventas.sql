-- 233 · El PDF de cada comprobante de VENTA (ESTRUCTURA) — A-FEAT-1578. OK JMS 07/11: «si adelante con la mejora» (aviso previo a Javier en ENTRE-DESARROLLADORES).
-- Una columna vacía `pdf_drive_url` (el link al PDF en el Drive, carpeta «- Ventas» del mes) en msa/pam/ma.comprobantes_venta, como
-- `comprobantes_arca.pdf_drive_url` en compras. No toca RLS, roles ni datos. Se frena si la columna ya existe (así el deshacer sólo borra lo suyo).
-- Deshacer: 233-pdf-de-ventas-deshacer.sql.
begin;
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'comprobantes_venta' and column_name = 'pdf_drive_url') then
    raise exception '233: pdf_drive_url ya existe en algún comprobantes_venta — no se corre';
  end if;
end $$;
alter table msa.comprobantes_venta add column pdf_drive_url text;
alter table pam.comprobantes_venta add column pdf_drive_url text;
alter table ma.comprobantes_venta  add column pdf_drive_url text;
comment on column msa.comprobantes_venta.pdf_drive_url is '[script 233] link al PDF del comprobante en el Drive (A-FEAT-1578)';
comment on column pam.comprobantes_venta.pdf_drive_url is '[script 233] link al PDF del comprobante en el Drive (A-FEAT-1578)';
comment on column ma.comprobantes_venta.pdf_drive_url  is '[script 233] link al PDF del comprobante en el Drive (A-FEAT-1578)';
commit;
