-- Deshace el [script 318].
begin;
delete from productivo.movimientos_insumos where observaciones like '[script 318]%';   -- los vínculos se van con ellas (cascade)
update productivo.stock_insumos set cantidad = cantidad - 6000, costo_unitario = 0 where id = 'bf021076-bd4c-42ee-a61c-ddcd0823e947';
update productivo.stock_insumos set cantidad = cantidad - 3000, costo_unitario = 0 where id = 'a167aae2-687b-48a2-a673-f58cee565295';
update public.factura_renglones set insumo_stock_id = null where empresa = 'MSA' and comprobante_id in ('7de39425-76e6-42e4-b77a-97cbb2bf3907','fa0c6f67-0d91-4304-bb06-0ae2a017ed70');
update productivo.mediciones_insumo set cantidad = 450, notas = split_part(notas, ' · [script 318]', 1) where id = '2cad97bd-a498-48e6-993f-6d3e055505e5';
delete from productivo.mediciones_insumo where notas like '[script 318]%';
commit;
