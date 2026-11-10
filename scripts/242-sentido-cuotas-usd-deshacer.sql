-- Deshace el 242 (por las marcas que dejó en la descripción).
begin;
update public.cuotas_egresos_sin_factura set tipo_movimiento = 'ingreso', descripcion = replace(descripcion, ' [script 242: era ingreso]', '') where descripcion like '%[script 242: era ingreso]';
update public.cuotas_egresos_sin_factura set monto = -65250.00, descripcion = replace(descripcion, ' [script 242: monto era -65250]', '') where id = '83bbae60-1688-4e51-b448-827ca0ddc24f';
update public.cuotas_egresos_sin_factura set monto = -1368.00, tipo_movimiento = 'egreso', descripcion = replace(descripcion, ' [script 242: monto era -1368, egreso]', '') where id = 'a33decf7-8730-42e9-9600-7798d357d187';
commit;
