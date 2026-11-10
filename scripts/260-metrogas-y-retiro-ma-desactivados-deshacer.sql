-- Deshace el 260: las 2 cuotas estaban «conciliado», $ 0, sin descripción.
begin;
update public.cuotas_egresos_sin_factura set estado = 'conciliado', descripcion = null where id in ('0c9b44e9-8e0f-4e78-a266-732289e9c066', '59dfb853-d2e1-40c8-9017-2695e3d50bdf') and descripcion like '%[script 260]';
commit;
