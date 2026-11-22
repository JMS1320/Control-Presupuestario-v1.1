-- Deshace el 292: vuelve a «NO» SÓLO si sigue en «egreso» (lo que dejó el 292), por id.
update public.egresos_sin_factura
   set tipo = 'NO'
 where id = '7a2c1e0e-247a-4c0b-9b1a-c07170000247'
   and tipo = 'egreso';
