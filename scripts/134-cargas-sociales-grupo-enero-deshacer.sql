-- Deshace 134: deja todo como estaba el 29/10/2026 antes del script.
begin;
update msa_galicia set template_cuota_id = 'e9786d0b-f3b7-4351-adad-8d4f357b78ba' where id = 'e23b41c8-e9d2-49fc-98cb-e683f23f31a0';
update msa_galicia set template_cuota_id = '8a86d0f4-ae19-48c5-b797-64a7ed80f45a' where id = '1564fd39-f07b-4da3-a337-9953dd4d632f';
update cuotas_egresos_sin_factura set grupo_pago_id = null, estado = 'anterior', detalle = null where id = 'e9786d0b-f3b7-4351-adad-8d4f357b78ba';
update cuotas_egresos_sin_factura set grupo_pago_id = null, estado = 'conciliado', detalle = null where id = '187ae62b-9e3d-45c8-a6b1-b49a78069696';
update cuotas_egresos_sin_factura set grupo_pago_id = null, estado = 'anterior', detalle = null, monto = 6090236.01 where id = '8a86d0f4-ae19-48c5-b797-64a7ed80f45a';
update cuotas_egresos_sin_factura set monto = 1747803.90, estado = 'anterior', detalle = null where id = 'fa189d24-6f78-4a3f-beac-ebfe2bf77c5b';
delete from msa.grupos_pago where id = 'c5a0c131-0000-4000-8000-000000000131';
commit;
