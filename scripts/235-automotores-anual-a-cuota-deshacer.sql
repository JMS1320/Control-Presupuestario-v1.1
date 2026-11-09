-- Deshace el 235 (sólo las filas que tocó, por id y con el estado que dejó).
begin;
update public.egresos_sin_factura set activo = true  where id in ('06c49a43-7547-49b7-aafc-aa75dba2b74f','5db555b9-dda3-4ccf-9f10-9060afd35034','5336e47c-a3b8-4d73-ab86-6e462bac97e6') and activo = false;
update public.egresos_sin_factura set activo = false where id in ('42a3d238-7765-4c47-b6c9-38ea4190aa44','cacc3523-9f3f-4c64-8771-dfece4ab8a60','404f2357-8f7c-4b8c-9b59-5015301b73a0') and activo = true;
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id in ('f993dc87-dbea-46b8-bc49-e78b47aee901','6b3a213e-4c80-4bd8-98cc-877f13872114','72f8fa0d-c10d-45b7-9db3-a8582bc57326') and estado = 'desactivado';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id in ('7bcae782-b860-4ce4-a562-7c64d5c992ac','5b205b1f-54d9-4489-88b8-a03f8ac5b710') and estado = 'pendiente';
commit;
