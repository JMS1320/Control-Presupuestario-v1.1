-- Deshace el 239 (por id, a la foto 239-foto-antes.json).
begin;
update public.egresos_sin_factura set responsable='PAM' where id in ('d2c1fbbe-8e85-4445-824e-eb590abf4fe2','0dacc6ab-515c-4651-a685-39a037fc8a83') and responsable='MA';
update public.egresos_sin_factura set responsable='PAM', "año"=null, cuenta_agrupadora='Fijos Buenos Aires MA' where id='11c9f9a1-5a27-4657-959e-6c94ea4ea4d4';
commit;
