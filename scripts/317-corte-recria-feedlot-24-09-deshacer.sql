-- Deshace el [script 317] (valores anteriores verificados el 27/11).
begin;
update productivo.mediciones_insumo set fecha = '2026-09-19' where id in ('615fa41f-f5b4-495b-8b04-d517acab0983','2cad97bd-a498-48e6-993f-6d3e055505e5');
update productivo.lote_tramos set fecha_hasta = '2026-09-15' where id in ('2ad5c3d1-03f0-4a41-bb56-12b2d7c40ddc','137cffea-769e-4f0a-b8b7-6d8f9d27048a');
update productivo.lote_tramos set fecha_desde = '2026-09-15' where id in ('917ede18-c8b4-43f1-bbab-5be7afef092d','4e1a7f99-72b9-48fa-bc8c-6c165e69e248');
update productivo.lote_tramos set fecha_hasta = '2026-10-01' where id in ('8d6f6092-c9e2-46d4-bc3a-78908c4f6a19','800977fc-3272-4665-ad2f-4a816cef2edd');
update productivo.actividad_insumos set insumo_stock_id = null where id = 'f305f048-de83-4e6c-bf2b-fd75cd9eb895';
commit;
