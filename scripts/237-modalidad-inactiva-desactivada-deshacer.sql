-- Deshace el 237 (por id, al estado de la foto).
begin;
update public.cuotas_egresos_sin_factura set estado='conciliado' where id in ('44ec7977-c6e7-4989-823c-617e7c5ede66','e25415a1-7fac-40f3-8f06-643857d23e3d','a5e0616b-4daf-43bd-8452-e1364ab60f25') and estado='desactivado';
update public.cuotas_egresos_sin_factura set estado='pendiente' where id in ('d5773122-7592-4757-ae09-d78f06cbb305','d620116e-9235-4572-9692-ccdec8679cc1','d57b98d1-344a-4ea4-8c7a-587cb2ba0716','2654296f-43e7-4c09-a128-514010cd6a02','8439bd95-a0c2-4c47-8783-7b1a5e3bb966','cde6a96f-0e47-469d-9df4-d34090d7a165','6558f4ca-2678-4eef-a0b5-53ff344b0754','b7c75122-da87-4faf-ad0b-00cdbd7d7821') and estado='desactivado';
update public.egresos_sin_factura set grupo_impuesto_id='Inmobiliario Quinta Rosello 1', partida_arba=null where id='7e0c3b4a-a717-4f64-b9dd-b2532c2a0c97';
commit;
