-- [script 309] DESHACER — borra sólo lo que creó el 309 (marcado «[script 309]») y devuelve el precio y el stock como estaban.
begin;
delete from productivo.entrega_factura where notas like '[script 309]%';
update productivo.stock_insumos set cantidad = cantidad - 25560, updated_at = now()
 where id = '6a3c2042-5b75-4c2a-9962-3e6e62b87be4'
   and exists (select 1 from productivo.movimientos_insumos where observaciones like '[script 309]%' and fecha = '2026-10-06');
delete from productivo.movimientos_insumos where observaciones like '[script 309]%' and fecha = '2026-10-06';
update productivo.movimientos_insumos
   set costo_unitario = null,
       observaciones = nullif(regexp_replace(observaciones, '( - )?\[script 309\].*$', ''), '')
 where id = '8f8ebbec-0d07-4a09-873e-d574353ab959';
commit;
