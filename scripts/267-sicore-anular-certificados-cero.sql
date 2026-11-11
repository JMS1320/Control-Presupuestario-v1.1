-- [script 267] nota JMS 11/11 («sicore registró una retención de cero, eso es un error» · «anularías las de hoy de cero?
-- las anteriores dejalas»): se anulan las 3 filas del 11/11 con retención $ 0 que estrenaron certificado propio
-- (086 Rigo, 087 Hernández Cristóbal, 089 Hidráulica Curra; quincena 26-11 1ra, abierta). Ningún mail de certificado salió.
-- Foto antes: anulado = false, fecha_anulacion = null, motivo_anulacion = null. La de Alcorta del 10/09 (063) no se toca.
update msa.sicore_retenciones set anulado = true, fecha_anulacion = now(),
  motivo_anulacion = '[script 267] Retención $ 0 sin otra retención en el pago: no corresponde certificado (A-BUG-1609)'
where id in ('c19f97b9-ac91-492d-bfab-fe1dcbd7294f','5fec515f-bce4-4fb3-a35c-f3a0b585bd6f','1be3d959-b614-46bf-868d-b257c4fdd582')
  and anulado = false and retencion = 0;
