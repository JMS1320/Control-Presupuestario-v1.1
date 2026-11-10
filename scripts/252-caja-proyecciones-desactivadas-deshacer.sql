-- Deshace el 252: las 7 estaban «conciliado» y sin descripción (252-foto-antes.json).
begin;
update public.cuotas_egresos_sin_factura set estado = 'conciliado', descripcion = null where id in ('1560b34a-206f-430e-b8b7-e69f283df481','ef8c0186-e5ad-49d6-a8b3-5afc5daaba29','124389cf-3702-499f-992e-ab284f032a7a','a29f8c0c-0e08-401f-8b2d-d558fcc6c495','8e61d215-1c1f-4767-8319-c00307c52fae','f0828de9-6eba-4a93-8cfc-7d20742184d4','514d4458-80da-459f-a835-b716595c444c') and descripcion like '%[script 252]';
commit;
