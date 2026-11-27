-- Deshace el [script 315]: vuelve a vacío exactamente los 7 renglones (la columna era nueva y estaba vacía).
begin;
update productivo.actividad_insumos set insumo_stock_id = null where id in (
 '34c05560-6bac-4df4-b7c3-9f89ca57a9c1','3dfaad83-17e9-4336-896d-6134a1ced07f','cf06a833-6b59-4241-8bba-761be5411542',
 '102c1363-47e0-4c59-a360-3034806aa538','08049507-0e67-4404-8879-f2a2861fbab2','d44f987b-9862-4596-a7ef-e896305ea24b','c93eb0d0-e88b-4e24-9c12-25f7eb438a05');
commit;
