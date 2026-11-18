-- 285 · BALANCE PROPIO MSA, versión JMS: caja real, distribución en cero, cuota solidaria y cuenta de MA (DATOS)  A-FEAT-1629
-- JMS 17/11 en esta terminal: «caja gral 0, Sigot $ 430.873,00, AMS $ 197.340,68: eso es lo real de caja» · «C2 ok» (cuota
-- solidaria como el contador) · «C3 sólo iría el de MA y el resto cero las dos puntas» · MA: «cargar el interno… como
-- tentativo… se tomaría como un activo en MSA porque es un anticipo de algo, ya sea arrendamiento o distribución» ·
-- Plácido: «C4 ok nota de balance».
-- Toca public.balance_foto_valores: 3 filas existentes (por id) y 2 nuevas en la foto 30/06/2026. Deshacer: 285-…-deshacer.sql.

begin;

update public.balance_foto_valores
   set importe = 628213.68, origen = 'planilla', updated_at = now(),
       detalle = '[script 285] lo real de caja (JMS 17/11, planilla de cajas de AMS «- CAJA 25-26.xlsx»): General 0,00 · AMS 197.340,68 · Sigot 430.873,00. Antes: 1766085.92 — [script 273] cajas de la app al cierre: General 457.212,92 · AMS 0 · Sigot 1.308.873 (papel F · Caja y bancos)'
 where id = 'a49bb1ed-549f-415c-8a96-68788cc151d4';

update public.balance_foto_valores
   set importe = 0, origen = 'manual', updated_at = now(),
       detalle = '[script 285] en cero en las dos puntas (JMS 17/11): de los socios sólo va la cuenta de MA. Antes: 64623846.86 — [script 273] propuesta: saldo con socios al cierre (−90.123.846,86) − al inicio (−25.500.000)'
 where id = '8a70bf97-ede7-47ec-9eb3-e1347ff2db02';

update public.balance_foto_valores
   set importe = 0, origen = 'manual', updated_at = now(),
       detalle = '[script 285] en cero en las dos puntas (JMS 17/11). Antes: 11200207 (planilla, sin detalle)'
 where id = 'dc171a41-2fec-48de-886d-3554d70fd9bf';

insert into public.balance_foto_valores (foto_id, renglon, version, importe, origen, detalle) values
 ('29447556-df4e-468d-866c-0576e9d82344', 'cuota_solidaria', 'jms', 85233.06, 'planilla',
  '[script 285] como el contador (JMS 17/11). Para el balance en línea: el total que se carga en el template de cargas sociales es SUSS + cuota solidaria'),
 ('29447556-df4e-468d-866c-0576e9d82344', 'cuenta_socios', 'jms', 92875208.86, 'manual',
  '[script 285] TENTATIVO (JMS 17/11): sólo Mercedes Areco, por su cuenta interna (export «Socios y Libertad» 15/11): saldo con MSA 44.459.338,17 + compensación interna 28.915.870,69 + ajuste fijo 19.500.000,00. Es un anticipo (de arrendamiento o de distribución). Los demás socios, en cero. NOTA DE BALANCE: Socio Plácido Martínez 45.905.575,52, el mismo saldo al inicio y al cierre, fuera del cálculo para que no pese en la ganancia.');

commit;
