-- 279 · A-FEAT-1585 — DESHACER de la CARGA INICIAL de las cajas que JMS hace desde la app (Extracto → caja → Importar, tildando
-- «Carga inicial (histórico)» con el saldo al 30/06/2025). Esa carga no es un script: la hace el importador. Cada renglón que crea
-- lleva en la nota la marca «[carga inicial cajas]» (también los 3 «Saldo al 30/06/2025»), y esto borra SÓLO esos.
-- No toca los 79 de Sigot (script 278) ni los 2 de AMS (script 245), que no llevan la marca.
-- Antes de correrlo: select cuenta, count(*) from msa.caja_general where nota_operador like '%[carga inicial cajas]%' group by 1 (ídem ams, sigot).
-- Esperado al 15/11/2026: General 173 · Sigot 176 · AMS 194 (los nuevos + el renglón del saldo de cada una).
begin;
delete from msa.caja_general where nota_operador like '%[carga inicial cajas]%' and estado = 'historico';
delete from msa.caja_ams     where nota_operador like '%[carga inicial cajas]%' and estado = 'historico';
delete from msa.caja_sigot   where nota_operador like '%[carga inicial cajas]%' and estado = 'historico';
commit;
