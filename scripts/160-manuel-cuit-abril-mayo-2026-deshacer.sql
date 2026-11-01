-- Deshace 160 · los dos movimientos vuelven a pendiente, se borran SÓLO los pagos y períodos que creó el 160 y el CUIT vuelve a vacío.
update public.msa_galicia set sueldo_pago_id = null, estado = 'pendiente', categ = 'INVALIDA:', detalle = ''
 where id in ('5015630e-c85b-4f51-bee4-e68a3a3b37c1', '42fa3b63-393c-4e1d-b86b-9fbaaafa1c36')
   and sueldo_pago_id in ('7f6bd6ed-0b69-48d1-87eb-203e24bdea69', 'e32798d4-a891-4df3-b4c3-a6e437fc97d6');
delete from sueldos.pagos where id in ('7f6bd6ed-0b69-48d1-87eb-203e24bdea69', 'e32798d4-a891-4df3-b4c3-a6e437fc97d6') and descripcion like '%[script 160]%';
delete from sueldos.periodos where id in ('0ef58eb7-0a17-43d7-9a2c-9ee89a06238e', '4c3124bd-16a6-40e6-b9a9-07e1a1192daa') and observaciones like '%[script 160]%';
update sueldos.empleados set cuit_empleado = null where id = 'cc7272c6-50ec-4ba9-a535-047b2a6f8227' and cuit_empleado = '24-24754471-9';
