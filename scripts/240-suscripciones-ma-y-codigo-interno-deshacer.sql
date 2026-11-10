-- Deshace el 240 (por id, a la foto 240-foto-antes.json).
begin;
update public.egresos_sin_factura set responsable='PAM' where id in ('bd25be0d-4de4-4e13-9481-81ddeaed910b','d109075b-01ac-4b14-8952-b1c9bfd60219','dd9063da-a5e6-4ab5-b4b7-42662ad32b2e','efbd5129-5c88-41d1-b1a0-be69221849b3') and responsable='MA';
update public.egresos_sin_factura set codigo_interno='DIST MA' where id in ('bd25be0d-4de4-4e13-9481-81ddeaed910b','d109075b-01ac-4b14-8952-b1c9bfd60219','dd9063da-a5e6-4ab5-b4b7-42662ad32b2e','efbd5129-5c88-41d1-b1a0-be69221849b3','d2c1fbbe-8e85-4445-824e-eb590abf4fe2','0dacc6ab-515c-4651-a685-39a037fc8a83','11c9f9a1-5a27-4657-959e-6c94ea4ea4d4') and codigo_interno is null;
commit;
