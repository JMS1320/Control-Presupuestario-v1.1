-- 227 · RED VIAL SAN PEDRO 2026 CUOTA 3: vencimiento real y su boleta vinculada (DATOS). JMS 06/11: «sí aplicá las 15».
--
-- De dónde sale: el mail de Solana Font (Rentas San Pedro) del 27/08/2026, archivado por JMS desde Mails → Para guardar
-- («2026-08-27 - RV San Manuel - cuota 3.pdf», 16 boletas). Cruce por número de cuenta municipal con la planilla base de JMS
-- («INMOBILIARIO RED VIAL AUTOMOTOR 2026 - v2», sección Red Vial). Vencimiento de todas: 11/09/2026.
-- Control: MSA 9 boletas = $ 468.762,23 y PAM 6 = $ 1.042.045,82 = lo pagado por la cuota 2 el 16/06 (Galicia MSA). Cada
-- importe es igual al monto que ya tiene la cuota: los MONTOS NO SE TOCAN.
-- Fuera: Lote Puerto (no viene en estas boletas), Quinta Rosello 1/2 (a nombre de Rosello Ethel), Grimoldi 60263 (no es nuestra).
--
-- Qué escribe:
--   1) public.cuotas_egresos_sin_factura: fecha_vencimiento y fecha_estimada = 2026-09-11 en las 15 cuotas (estaban 05/09, sin
--      vencimiento). Sólo si siguen pendientes y con fecha estimada 05/09.
--   2) public.mails_registro (el mail del 27/08): suma un vínculo a cada cuota → el 📎 de la cuota muestra la boleta
--      (mismo mecanismo que «Pasar el monto a su cuota»). Marca «[script 227]» en cada vínculo.
-- Deshacer: 227-…-deshacer.sql (vuelve las fechas por id y saca sólo los vínculos marcados).

begin;

update public.cuotas_egresos_sin_factura
   set fecha_vencimiento = '2026-09-11', fecha_estimada = '2026-09-11', updated_at = now()
 where id in (
  '37d7e7b2-430f-459b-ba0a-3a393e811077', -- MSA Anexo        52819  57.011,62
  '27730787-b5ea-4ace-8de7-f6e15c3c435c', -- MSA Cholo 1      52937  41.175,06
  '5695b7db-b979-4fe5-97d0-6351d1fd25d1', -- MSA Cholo 2      52938  38.007,75
  '7f717500-8d5e-4fe3-8767-9f7860836217', -- MSA Portería N.  52943  53.844,31
  'b7146a2e-06af-456d-8c8d-747faf81c758', -- MSA Portería V.  52944  53.844,31
  'bb2ccdd1-72d8-44aa-b4d7-cd7633c4ca7d', -- MSA Sánchez      52945  57.011,62
  '49da117d-1b5c-48c4-8c61-0f293c97f78a', -- MSA Tango Parra 1 52948 53.844,31
  '64d33119-b272-4963-a5db-fcbbde99056e', -- MSA Tango Parra 2 52950 60.178,94
  'cd60e402-249f-4689-a456-aa45e4065c38', -- MSA Prim Leboso  52946  53.844,31
  '1fe3c5df-8fc6-4839-a2f8-af75ac77e7d7', -- PAM Casco        53017 538.443,12
  '33eb48c3-c501-44b9-ae2d-4fc5fcd78225', -- PAM Entre Ríos   61015  83.933,79
  '66699b79-f8a5-4b24-bff5-5d946f817225', -- PAM Ombú         52627 245.466,73
  'a1915fdd-7aa1-49fb-935c-0ac8ea6fa2a3', -- PAM Tapera 1     52947  57.011,62
  '41915c60-7b78-4102-8663-12135c63f9e2', -- PAM Tapera 2     52949  57.011,62
  '672cc229-628e-4cc8-b050-180363f24c7c'  -- PAM Tapera 3     52951  60.178,94
 ) and estado = 'pendiente' and fecha_estimada = '2026-09-05';

update public.mails_registro m
   set vinculos = coalesce(m.vinculos, '[]'::jsonb) || (
         select jsonb_agg(jsonb_build_object('schema','public','tabla','cuotas_egresos_sin_factura','id',x::text,
                          'que','[script 227] boleta Red Vial cuota 3/2026'))
           from unnest(array[
             '37d7e7b2-430f-459b-ba0a-3a393e811077','27730787-b5ea-4ace-8de7-f6e15c3c435c','5695b7db-b979-4fe5-97d0-6351d1fd25d1',
             '7f717500-8d5e-4fe3-8767-9f7860836217','b7146a2e-06af-456d-8c8d-747faf81c758','bb2ccdd1-72d8-44aa-b4d7-cd7633c4ca7d',
             '49da117d-1b5c-48c4-8c61-0f293c97f78a','64d33119-b272-4963-a5db-fcbbde99056e','cd60e402-249f-4689-a456-aa45e4065c38',
             '1fe3c5df-8fc6-4839-a2f8-af75ac77e7d7','33eb48c3-c501-44b9-ae2d-4fc5fcd78225','66699b79-f8a5-4b24-bff5-5d946f817225',
             'a1915fdd-7aa1-49fb-935c-0ac8ea6fa2a3','41915c60-7b78-4102-8663-12135c63f9e2','672cc229-628e-4cc8-b050-180363f24c7c'
           ]) x),
       updated_at = now()
 where m.id = '14c543d2-f883-4410-a374-dee9174abf90'
   and not exists (select 1 from jsonb_array_elements(coalesce(m.vinculos,'[]'::jsonb)) e where e->>'que' like '[script 227]%');

commit;
