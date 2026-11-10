-- 242 · Corrige el SENTIDO de las cuotas pasadas a pesos por el 241 (DATOS — bug de forma) — A-BUG-1584.
-- La conciliación de una compra en US$ con tarjeta ($ 0 en pesos) las marcaba «ingreso» (regla `debitos > 0`, arreglada en
-- lib/conciliacion/sentido-movimiento.ts para el Extracto y el motor). Con monto 0 no se notaba; al pasarlas a pesos RESTABAN.
-- Bug de forma → se corrige por default (CLAUDE.md § Datos), con foto y deshacer exacto. Las devoluciones: monto positivo, sentido «ingreso».
begin;
-- las compras (la tarjeta dice debitos_usd > 0): ingreso → egreso, y queda la marca para deshacer
update public.cuotas_egresos_sin_factura set tipo_movimiento = 'egreso', descripcion = descripcion || ' [script 242: era ingreso]'
 where descripcion like '%[script 241]' and tipo_movimiento = 'ingreso' and id <> '83bbae60-1688-4e51-b448-827ca0ddc24f' and monto > 0;
-- las 2 devoluciones (créditos en US$): monto positivo y «ingreso»
update public.cuotas_egresos_sin_factura set monto = 65250.00, descripcion = descripcion || ' [script 242: monto era -65250]' where id = '83bbae60-1688-4e51-b448-827ca0ddc24f' and monto = -65250.00;
update public.cuotas_egresos_sin_factura set monto = 1368.00, tipo_movimiento = 'ingreso', descripcion = descripcion || ' [script 242: monto era -1368, egreso]' where id = 'a33decf7-8730-42e9-9600-7798d357d187' and monto = -1368.00;
commit;
