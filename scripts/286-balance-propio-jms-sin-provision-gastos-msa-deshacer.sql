-- 286 · DESHACER: devuelve la provisión para gastos de las dos fotos (valores verificados en la base el 18/11, por id).

begin;

update public.balance_foto_valores set importe = 12456000.14, origen = 'manual', updated_at = now(),
       detalle = '[script 273] antes: no estaba en tu foto. Se toma la del contador (2.1.1/01/04)'
 where id = 'adf75e00-9ded-4e9c-b186-b1b3d0dd4dad' and detalle like '[script 286]%';

update public.balance_foto_valores set importe = 778144.76, origen = 'sistema', updated_at = now(),
       detalle = '[script 273] 10 facturas de gastos del ejercicio que llegaron después (papel 05) · P8'
 where id = '2ce796f5-e03b-436c-b153-7f2ce0fd9a0a' and detalle like '[script 286]%';

commit;
