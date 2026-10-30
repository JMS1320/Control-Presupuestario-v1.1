-- 143 · Estado «Pendiente» (mayúscula) → «pendiente» — A-FEAT-1430 / JMS 30/10: «ese tipo de bugs siempre resolvelos por default».
--
-- El bug: 18 tablas de cuentas tenían como valor por defecto de `estado` la palabra «Pendiente» con mayúscula. Todo el sistema
-- (el extracto, el motor de conciliación, los papeles) busca «pendiente» en minúscula: cada importador que no escribía el
-- estado dejaba movimientos que NINGÚN circuito tomaba. Medido 30/10: 270 movimientos (Santander 148, Cotitulares USD 67,
-- Cotitulares pesos 32, ANSES MA 22, cuenta USD MSA 1).
-- Arregla las dos cosas: los 270 movimientos y el valor por defecto de las 18 tablas (para que no vuelva).
-- Deshacer: 143-estado-pendiente-minuscula-deshacer.sql (vuelve EXACTAMENTE esos 270 ids y los defaults).

begin;

update msa.santander             set estado = 'pendiente' where estado = 'Pendiente';
update public.cotitulares_ca_usd set estado = 'pendiente' where estado = 'Pendiente';
update public.cotitulares_ca_pesos set estado = 'pendiente' where estado = 'Pendiente';
update ma.anses_ca_pesos         set estado = 'pendiente' where estado = 'Pendiente';
update msa.cc_usd                set estado = 'pendiente' where estado = 'Pendiente';

alter table ma.anses_ca_pesos alter column estado set default 'pendiente';
alter table ma.ca_usd alter column estado set default 'pendiente';
alter table ma.caja_usd alter column estado set default 'pendiente';
alter table ma.ma_galicia alter column estado set default 'pendiente';
alter table msa.caja_ams alter column estado set default 'pendiente';
alter table msa.caja_general alter column estado set default 'pendiente';
alter table msa.caja_sigot alter column estado set default 'pendiente';
alter table msa.caja_usd alter column estado set default 'pendiente';
alter table msa.cc_usd alter column estado set default 'pendiente';
alter table msa.echeqs_terceros alter column estado set default 'pendiente';
alter table msa.provincia alter column estado set default 'pendiente';
alter table msa.santander alter column estado set default 'pendiente';
alter table public.cotitulares_ca_pesos alter column estado set default 'pendiente';
alter table public.cotitulares_ca_usd alter column estado set default 'pendiente';
alter table public.cotitulares_caja_usd alter column estado set default 'pendiente';
alter table public.msa_galicia alter column estado set default 'pendiente';
alter table public.pam_galicia alter column estado set default 'pendiente';
alter table public.pam_galicia_cc alter column estado set default 'pendiente';

commit;
