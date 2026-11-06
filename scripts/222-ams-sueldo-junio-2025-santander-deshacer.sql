-- Deshace 222 · el movimiento vuelve a como estaba (histórico, sin categ) y se borran SÓLO el pago y el período del 222.
begin;
update msa.santander set sueldo_pago_id = null, estado = 'historico', categ = null, detalle = null, proveedor_nombre = null
 where id = '22fa8a8d-718a-489c-a9ef-443e5c2fe5e7' and sueldo_pago_id = '6e46274b-0711-4a69-bc0c-347b7a52710d';
delete from sueldos.pagos where id = '6e46274b-0711-4a69-bc0c-347b7a52710d' and descripcion like '%[script 222]%';
delete from sueldos.periodos where id = '541f0adf-4ef9-40a3-8532-a518dd37b301' and observaciones like '%[script 222]%';
commit;
