-- Deshace 163 · los 2 movimientos vuelven a pendiente, los meses bajan lo que subieron y se borran SÓLO los 2 pagos del 163.
update msa.santander set sueldo_pago_id = null, estado = 'pendiente', categ = null, detalle = null, proveedor_nombre = null
 where id in ('7d5fae13-6d72-4451-ade4-02f72ee2eca5', 'a394d55b-9938-4cc4-946b-1ae07bb3c709')
   and sueldo_pago_id in ('380f08ad-02b3-4890-9852-3ca24fbdc964', '4b75b23c-1a5d-4288-9595-d31dbabe5c97');
update sueldos.periodos set monto_a = monto_a - 389920, bruto_calculado = bruto_calculado - 389920, anticipos_descontados = anticipos_descontados - 389920,
  observaciones = replace(observaciones, ' · + $ 389.920 pagado por Santander el 01/08/2025 [script 163]', '')
 where id = 'c6dd10e8-c859-43f8-94d7-1ac4587c569c' and observaciones like '%[script 163]%';
update sueldos.periodos set monto_a = monto_a - 238994, bruto_calculado = bruto_calculado - 238994, anticipos_descontados = anticipos_descontados - 238994,
  observaciones = replace(observaciones, ' · + $ 238.994 pagado por Santander el 01/09/2025 [script 163]', '')
 where id = '5abfdadf-1bca-4e21-b334-81e879eed5ba' and observaciones like '%[script 163]%';
delete from sueldos.pagos where id in ('380f08ad-02b3-4890-9852-3ca24fbdc964', '4b75b23c-1a5d-4288-9595-d31dbabe5c97') and descripcion like '%[script 163]%';
