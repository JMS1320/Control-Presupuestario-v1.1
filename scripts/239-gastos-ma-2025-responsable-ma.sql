-- 239 · Consumos MA 2025, Gastos Médicos 2025 y Gastos Médicos (sin año): el responsable pasa de PAM a MA (DATOS) — A-FEAT-1579 / DR1.
-- OK JMS 10/11 (D1 «sí»): «son gastos de MA… tanto en 2025 como 2026 son de MA como responsable contable e interno».
-- Sólo los templates: no se toca ninguna cuota ni importe. El de «sin año» queda año 2026 (su única cuota es de 2026) y en su agrupadora.
-- El código interno («DIST MA») NO se toca todavía (pregunta D3 abierta). Las suscripciones 2025 (DR1.A3) tampoco (pregunta D2 abierta).
-- Foto: scripts/239-foto-antes.json · Excel de respaldo: Balance/respaldos/…ANTES script 239 (2026-11-10).xlsx · Deshacer: 239-…-deshacer.sql.
begin;
update public.egresos_sin_factura set responsable='MA' where id in ('d2c1fbbe-8e85-4445-824e-eb590abf4fe2','0dacc6ab-515c-4651-a685-39a037fc8a83') and responsable='PAM';
update public.egresos_sin_factura set responsable='MA', "año"='2026', cuenta_agrupadora='Gastos Personales MA'
  where id='11c9f9a1-5a27-4657-959e-6c94ea4ea4d4' and responsable='PAM';
commit;
