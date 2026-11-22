-- Deshace el 293: vuelve a vacío SÓLO si sigue con lo que puso el 293, por id.
update ma.ma_galicia
   set categ = null, detalle = null
 where id = 'a2565a11-2039-45ef-9ca7-43e969d9a60c'
   and categ = 'ARRENDAMIENTOS Venta' and detalle = 'Cobro Provinvest FCE 00001-00000002';
