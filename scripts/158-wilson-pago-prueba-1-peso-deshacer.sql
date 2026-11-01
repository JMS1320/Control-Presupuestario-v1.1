-- Deshace 158 · el movimiento vuelve a pendiente (CATEG inválida, sin detalle, sin vínculo) y se borra SÓLO el pago de $ 1 que creó el 158.
update public.msa_galicia set sueldo_pago_id = null, estado = 'pendiente', categ = 'INVALIDA:', centro_de_costo = null, detalle = ''
 where id = '3014cf6c-4868-49de-9ab7-28211fde2678' and sueldo_pago_id = 'aaddce15-876c-4edb-b6fd-5d864f7edc8a';
delete from sueldos.pagos where id = 'aaddce15-876c-4edb-b6fd-5d864f7edc8a' and monto = 1;
