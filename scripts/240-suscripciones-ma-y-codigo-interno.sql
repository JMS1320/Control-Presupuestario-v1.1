-- 240 · Suscripciones 2025 (Netflix, Paquete TV MA, Club La Nación, Jockey Club): responsable PAM → MA; y el código interno «DIST MA»
-- queda vacío en esos 4 y en los 3 del script 239 (DATOS) — A-FEAT-1579 / DR1.
-- OK JMS 10/11: «C1 esas suscripciones también son de MA» · «C ok» (código interno vacío: si paga MA no implica nada; si paga PAM, el
-- movimiento lleva DIST MA). No se toca ninguna cuota. Foto: scripts/240-foto-antes.json · Deshacer: 240-…-deshacer.sql.
begin;
update public.egresos_sin_factura set responsable='MA' where id in ('bd25be0d-4de4-4e13-9481-81ddeaed910b','d109075b-01ac-4b14-8952-b1c9bfd60219','dd9063da-a5e6-4ab5-b4b7-42662ad32b2e','efbd5129-5c88-41d1-b1a0-be69221849b3') and responsable='PAM';
update public.egresos_sin_factura set codigo_interno=null where id in ('bd25be0d-4de4-4e13-9481-81ddeaed910b','d109075b-01ac-4b14-8952-b1c9bfd60219','dd9063da-a5e6-4ab5-b4b7-42662ad32b2e','efbd5129-5c88-41d1-b1a0-be69221849b3','d2c1fbbe-8e85-4445-824e-eb590abf4fe2','0dacc6ab-515c-4651-a685-39a037fc8a83','11c9f9a1-5a27-4657-959e-6c94ea4ea4d4') and codigo_interno='DIST MA';
commit;
