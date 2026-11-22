-- 292 · Template «FLIA» (responsable MA): tipo «NO» → «egreso».
-- JMS 22/11/2026, página de MA, D-Q1: «sí». Con tipo NO, el Dashboard no sabía en qué sección poner su pago del 06/01/2026
-- (−$ 150.000, «Consumos MA — Martinez Placido Andres») y el control avisaba la diferencia. Una sola fila, por id.
update public.egresos_sin_factura
   set tipo = 'egreso'
 where id = '7a2c1e0e-247a-4c0b-9b1a-c07170000247'
   and tipo = 'NO';

select id, nombre_referencia, tipo from public.egresos_sin_factura where id = '7a2c1e0e-247a-4c0b-9b1a-c07170000247';
