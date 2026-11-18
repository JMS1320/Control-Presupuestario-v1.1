-- 284 · BALANCE PROPIO MSA 30/06/2026, versión JMS: lo fiscal pasa a ser lo del contador (DATOS)  A-FEAT-1629
-- JMS 17/11, en la página «Balance interno MSA»: créditos impositivos «ok contador» (filas 13 a 21) y Ganancias a pagar e
-- impuesto diferido «los dos del contador» (C2). En esta terminal: «E1 ok».
-- Lo que había eran valores NEUTROS del script 273 (los mismos US$ que al 30/06/25), puestos mientras no se conocía el dato.
-- El importe sale de la versión «contador» de la misma foto (script 283). El contador no tiene «Anticipos Imp. a las
-- Ganancias» ni «Saldo a favor Ingresos Brutos»: esos dos quedan en 0.
-- Toca: 9 filas existentes (por id) y 2 filas nuevas de public.balance_foto_valores. Deshacer: 284-…-deshacer.sql.

begin;

update public.balance_foto_valores j
   set importe = c.importe, origen = 'planilla', updated_at = now(),
       detalle = '[script 284] del balance presentado por el contador (JMS 17/11). Antes: ' || j.importe::text || ' — ' || coalesce(j.detalle, '')
  from public.balance_foto_valores c
 where j.foto_id = '29447556-df4e-468d-866c-0576e9d82344' and j.version = 'jms'
   and c.foto_id = j.foto_id and c.version = 'contador' and c.renglon = j.renglon
   and j.id in ('0c9e3273-7b7d-49e3-954c-0184bd29ff89','86fd229f-ab58-44ee-a479-ad7f647de21e','4d0ff398-dca6-428e-ae9c-f5c99422b645',
                '0ad838b6-084a-4b25-9a0f-7b4d61928ebb','217c157c-0e25-41bd-96d9-f80aa176d821','a6b5bf19-95e3-4981-9f04-654c5baa2931',
                'c47c6ac4-e91d-4bee-bfd6-56becbc77021');

update public.balance_foto_valores j
   set importe = 0, origen = 'planilla', updated_at = now(),
       detalle = '[script 284] el balance presentado por el contador no tiene este crédito (JMS 17/11). Antes: ' || j.importe::text || ' — ' || coalesce(j.detalle, '')
 where j.id in ('3c19691f-ecbc-4889-8f8a-352073182d36','522325e0-595f-472b-bf47-ebee6f522c4d');

insert into public.balance_foto_valores (foto_id, renglon, version, importe, origen, detalle)
select c.foto_id, c.renglon, 'jms', c.importe, 'planilla', '[script 284] del balance presentado por el contador (JMS 17/11). Antes: no estaba en tu versión'
  from public.balance_foto_valores c
 where c.foto_id = '29447556-df4e-468d-866c-0576e9d82344' and c.version = 'contador'
   and c.renglon in ('saldo_favor_ganancias', 'iva_credito_a_computar');

commit;
