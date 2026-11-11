-- Deshace [script 269]: las 2 ventas vuelven a Factura A (foto antes) y se borra el tipo 190 sólo si ningún otro comprobante lo usa.
update msa.comprobantes_venta set tipo_comprobante = 1
where id in ('a4403788-2cca-4343-89ae-e6b55b50c6bc','3723581a-6dcf-40ff-a258-be3e1f3e2d8f') and tipo_comprobante = 190;
delete from public.tipos_comprobante_afip where codigo = 190
  and not exists (select 1 from msa.comprobantes_venta where tipo_comprobante = 190)
  and not exists (select 1 from pam.comprobantes_venta where tipo_comprobante = 190)
  and not exists (select 1 from ma.comprobantes_venta where tipo_comprobante = 190)
  and not exists (select 1 from msa.comprobantes_arca where tipo_comprobante = 190);
