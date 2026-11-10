-- 260 · P2 de «Propuestas» v5 (JMS 10/11). Mismo criterio que ya aprobó (Expensas Libertad ene-26, script 254; Caja, script 252):
--  · Metrogas Libertad 10/01/26 en $ 0 «conciliado»: el gas de enero SÍ se pagó — débito automático del Galicia PAM CA el 12/01/26 ($ 5.631,63),
--    que ya está vinculado a la otra cuota de enero del mismo template (12/01/26). Esta es la repetida → desactivada.
--  · Retiro MA mensual 31/01/26 en $ 0: proyección de fin de mes que no se usó; los retiros reales de enero tienen su cuota (12/01 MSA $ 150.000;
--    15/01 y 22/01 de PAM). → desactivada. (El candidato de la cuenta de cotitulares del 10/03 es una compra de dólares, no un retiro.)
-- Foto: las 2 estaban «conciliado», $ 0, sin descripción. Deshacer: 260-…-deshacer.sql
begin;
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = 'repetida: el gas de enero-26 se pagó el 12/01 desde Galicia PAM CA y está en la cuota del 12/01 [script 260]'
 where id = '0c9b44e9-8e0f-4e78-a266-732289e9c066' and estado = 'conciliado' and monto = 0;
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = 'proyección de fin de mes que no se usó: los retiros de enero-26 tienen su propia cuota [script 260]'
 where id = '59dfb853-d2e1-40c8-9017-2695e3d50bdf' and estado = 'conciliado' and monto = 0;
commit;
