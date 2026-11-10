-- 252 · P2 «Caja» (OK de JMS 10/11: «si se trata de templates a caja que no se usaron… si se dejan desactivados por no usarse estaría bien»).
-- 7 cuotas mensuales de proyección (el 25 de cada mes, jul-25 → ene-26) en $ 0 «conciliado» sin ningún movimiento: la proyección que no se usó.
-- Las extracciones reales a caja tienen su propia cuota (48, $ 29 M) y no se tocan. Foto: 252-foto-antes.json (las 7 estaban «conciliado», sin descripción).
begin;
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = 'proyección mensual de caja que no se usó (las extracciones tienen su cuota) [script 252]'
 where id in ('1560b34a-206f-430e-b8b7-e69f283df481','ef8c0186-e5ad-49d6-a8b3-5afc5daaba29','124389cf-3702-499f-992e-ab284f032a7a','a29f8c0c-0e08-401f-8b2d-d558fcc6c495','8e61d215-1c1f-4767-8319-c00307c52fae','f0828de9-6eba-4a93-8cfc-7d20742184d4','514d4458-80da-459f-a835-b716595c444c') and estado = 'conciliado' and monto = 0;
commit;
