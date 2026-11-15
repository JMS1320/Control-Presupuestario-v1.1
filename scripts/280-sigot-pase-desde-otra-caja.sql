-- 280 · A-FEAT-1585 — corrige 2 de los 79 de Sigot que el 278 dejó como «Pase desde el banco» («orden extraccion jose» 21/02/26 y 20/03/26).
-- JMS 15/11 (P4): la extracción va SIEMPRE primero a la Caja General → en Sigot, una entrada «orden extracción» viene de otra caja.
-- (El 21/02 igual se une con la extracción del 23/02 como «directo, sin pasar por la General»: el panel lo marca.) Autorizado:
-- «podés cambiar los datos previos en caja Sigot». Deshacer: 280-sigot-pase-desde-otra-caja-deshacer.sql
-- ✅ CORRIDO 15/11/2026 (por id, sólo si seguía «Pase desde el banco»).
begin;
update msa.caja_sigot set descripcion = 'Pase desde otra caja', nota_operador = nota_operador || ' · [script 280]'
 where id in ('18e9f1e4-510e-41a2-bfaa-1c9fece4c927', '87ba9dff-ecea-4367-a644-9f91b9e2b809') and descripcion = 'Pase desde el banco';
commit;
