-- [script 269] A-DAT-102 (OK de JMS 11/11: «sí agregá el 190 … ¿arreglás las 2 ventas que no tienen bien tipo 190?»)
-- 1) El tipo de comprobante 190 «Liquidación de Venta Directa» en el catálogo (no existía).
-- 2) Las 2 ventas de toros del 29/10/2026 cargadas como Factura A (1) porque faltaba el 190 → 190.
--    Foto antes: tipo_comprobante = 1 en las dos; ddjj_iva = 'Imputado' (no enviadas al contador).
insert into public.tipos_comprobante_afip (codigo, descripcion, es_nota_credito, activo)
select 190, 'Liquidación de Venta Directa', false, true
where not exists (select 1 from public.tipos_comprobante_afip where codigo = 190);
update msa.comprobantes_venta set tipo_comprobante = 190
where id in ('a4403788-2cca-4343-89ae-e6b55b50c6bc',  -- Rojas Lagarde SRL, 10-14, $ 10.497.500
             '3723581a-6dcf-40ff-a258-be3e1f3e2d8f')  -- Sanchez Daniel German, 10-13, $ 11.050.000
  and tipo_comprobante = 1;
