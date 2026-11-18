-- 285 · DESHACER: devuelve las 3 filas a lo que tenían (verificado en la base el 17/11, por id) y borra las 2 que creó el 285.
-- Sólo toca filas que sigan marcadas [script 285].

begin;

update public.balance_foto_valores set importe = 1766085.92, origen = 'sistema', updated_at = now(),
       detalle = '[script 273] cajas de la app al cierre: General 457.212,92 · AMS 0 · Sigot 1.308.873 (papel F · Caja y bancos)'
 where id = 'a49bb1ed-549f-415c-8a96-68788cc151d4' and detalle like '[script 285]%';

update public.balance_foto_valores set importe = 64623846.86, origen = 'manual', updated_at = now(),
       detalle = '[script 273] propuesta: lo que los socios se llevaron neto en el año = saldo con socios al cierre (−90.123.846,86) − al inicio (−25.500.000), papel Cuentas de socios · confirmalo en su 💬'
 where id = '8a70bf97-ede7-47ec-9eb3-e1347ff2db02' and detalle like '[script 285]%';

update public.balance_foto_valores set importe = 11200207, origen = 'planilla', updated_at = now(), detalle = null
 where id = 'dc171a41-2fec-48de-886d-3554d70fd9bf' and detalle like '[script 285]%';

delete from public.balance_foto_valores
 where foto_id = '29447556-df4e-468d-866c-0576e9d82344' and version = 'jms'
   and renglon in ('cuota_solidaria', 'cuenta_socios') and detalle like '[script 285]%';

commit;
