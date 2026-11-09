-- 235 · Automotores Gol 2012, Tiguan 2012 y Toyota 2015: el ANUAL se desactiva y el de CUOTAS se activa (DATOS) — A-FEAT-1579.
-- OK JMS 09/11: «desactivar anuales, activar cuotas… no fueron pagas así que irían a adeudadas»; E2 «a pendiente y todas sus cuotas en pendiente».
-- No se tocan las cuotas 2025 de Toyota (conciliadas en $0 sin pago: JMS quiere que salte la alarma) ni se crean cuotas.
-- Ninguna de estas cuotas tiene movimiento bancario vinculado (verificado 09/11). Foto: scripts/235-foto-antes.json. Deshacer: 235-…-deshacer.sql.
begin;
-- templates: anual → inactivo, cuota → activo
update public.egresos_sin_factura set activo = false where id in ('06c49a43-7547-49b7-aafc-aa75dba2b74f','5db555b9-dda3-4ccf-9f10-9060afd35034','5336e47c-a3b8-4d73-ab86-6e462bac97e6') and activo = true;
update public.egresos_sin_factura set activo = true  where id in ('42a3d238-7765-4c47-b6c9-38ea4190aa44','cacc3523-9f3f-4c64-8771-dfece4ab8a60','404f2357-8f7c-4b8c-9b59-5015301b73a0') and activo = false;
-- la cuota de cada anual → desactivado
update public.cuotas_egresos_sin_factura set estado = 'desactivado' where id in ('f993dc87-dbea-46b8-bc49-e78b47aee901','6b3a213e-4c80-4bd8-98cc-877f13872114','72f8fa0d-c10d-45b7-9db3-a8582bc57326') and estado = 'conciliado';
-- la cuota 05/01/26 de Gol y Tiguan no se pagó → pendiente (las de abril y julio ya lo están)
update public.cuotas_egresos_sin_factura set estado = 'pendiente' where id in ('7bcae782-b860-4ce4-a562-7c64d5c992ac','5b205b1f-54d9-4489-88b8-a03f8ac5b710') and estado = 'conciliado';
commit;
