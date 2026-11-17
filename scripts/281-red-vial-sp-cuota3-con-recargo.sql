-- 281 · RED VIAL SAN PEDRO 2026 CUOTA 3: el monto pasa a lo que hay que pagar HOY, con el recargo (DATOS).
-- JMS 17/11: «llegaron las boletas de red vial por mail… hay que pagarlo hoy… tengo que tener el monto a pagar partida por
-- partida… si está todo claro lo podés llenar vos».
--
-- De dónde sale: el mail de Paola Antonelli (Rentas San Pedro) del 17/11/2026 08:54, casilla sanmanuel.sp, con 19 «Estado de
-- Deuda al 17/11/2026» (esta vez mandaron aviso de deuda y no boleta). En las 15 cuentas de Red Vial la única deuda es la cuota
-- 3/2026 (vto 11/09/2026); el importe original de cada una es igual al monto que ya tiene la cuota en el sistema.
-- Cruce por cuenta municipal: el mismo del script 227 (planilla base de JMS).
-- Control: 9 cuentas de San Manuel SRL = $ 494.543,67 · 6 de Plácido Martínez Sobrado = $ 1.099.357,28 · total $ 1.593.900,95
-- = suma de «Total Deuda» de los 15 informes. El recargo es AL 17/11: si se paga otro día, el importe cambia.
--
-- Qué escribe: public.cuotas_egresos_sin_factura, 15 filas por id — monto (importe + recargo) y descripcion (estaba vacía) con
-- la marca «[script 281]» y el desglose. Sólo si la cuota sigue pendiente, con el monto original y sin descripción.
-- No toca fechas, estado, ni las cuotas de automotores ni el ABL 20021 (quedan como propuesta para JMS).
-- Deshacer: 281-…-deshacer.sql (vuelve monto y descripción por id, sólo en las filas marcadas).

begin;

update public.cuotas_egresos_sin_factura c
   set monto = v.monto_nuevo, descripcion = v.descripcion, updated_at = now()
  from (values
  ('37d7e7b2-430f-459b-ba0a-3a393e811077'::uuid, 57011.62, 60147.20, '[script 281] Red Vial 3/2026 cuenta 52819: importe 57.011,62 + recargo 3.135,58 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- MSA Anexo
  ('27730787-b5ea-4ace-8de7-f6e15c3c435c'::uuid, 41175.06, 43439.65, '[script 281] Red Vial 3/2026 cuenta 52937: importe 41.175,06 + recargo 2.264,59 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- MSA Cholo 1
  ('5695b7db-b979-4fe5-97d0-6351d1fd25d1'::uuid, 38007.75, 40098.14, '[script 281] Red Vial 3/2026 cuenta 52938: importe 38.007,75 + recargo 2.090,39 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- MSA Cholo 2
  ('7f717500-8d5e-4fe3-8767-9f7860836217'::uuid, 53844.31, 56805.69, '[script 281] Red Vial 3/2026 cuenta 52943: importe 53.844,31 + recargo 2.961,38 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- MSA Portería Nuevo
  ('b7146a2e-06af-456d-8c8d-747faf81c758'::uuid, 53844.31, 56805.69, '[script 281] Red Vial 3/2026 cuenta 52944: importe 53.844,31 + recargo 2.961,38 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- MSA Portería Viejo
  ('bb2ccdd1-72d8-44aa-b4d7-cd7633c4ca7d'::uuid, 57011.62, 60147.20, '[script 281] Red Vial 3/2026 cuenta 52945: importe 57.011,62 + recargo 3.135,58 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- MSA Sánchez
  ('cd60e402-249f-4689-a456-aa45e4065c38'::uuid, 53844.31, 56805.69, '[script 281] Red Vial 3/2026 cuenta 52946: importe 53.844,31 + recargo 2.961,38 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- MSA Tango Prim Leboso
  ('49da117d-1b5c-48c4-8c61-0f293c97f78a'::uuid, 53844.31, 56805.69, '[script 281] Red Vial 3/2026 cuenta 52948: importe 53.844,31 + recargo 2.961,38 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- MSA Tango Parra 1
  ('64d33119-b272-4963-a5db-fcbbde99056e'::uuid, 60178.94, 63488.72, '[script 281] Red Vial 3/2026 cuenta 52950: importe 60.178,94 + recargo 3.309,78 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- MSA Tango Parra 2
  ('1fe3c5df-8fc6-4839-a2f8-af75ac77e7d7'::uuid, 538443.12, 568056.95, '[script 281] Red Vial 3/2026 cuenta 53017: importe 538.443,12 + recargo 29.613,83 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- PAM Casco
  ('33eb48c3-c501-44b9-ae2d-4fc5fcd78225'::uuid, 83933.79, 88550.06, '[script 281] Red Vial 3/2026 cuenta 61015: importe 83.933,79 + recargo 4.616,27 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- PAM Entre Ríos
  ('66699b79-f8a5-4b24-bff5-5d946f817225'::uuid, 245466.73, 258967.15, '[script 281] Red Vial 3/2026 cuenta 52627: importe 245.466,73 + recargo 13.500,42 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- PAM Ombú
  ('a1915fdd-7aa1-49fb-935c-0ac8ea6fa2a3'::uuid, 57011.62, 60147.20, '[script 281] Red Vial 3/2026 cuenta 52947: importe 57.011,62 + recargo 3.135,58 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- PAM Tapera 1
  ('41915c60-7b78-4102-8663-12135c63f9e2'::uuid, 57011.62, 60147.20, '[script 281] Red Vial 3/2026 cuenta 52949: importe 57.011,62 + recargo 3.135,58 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)'),  -- PAM Tapera 2
  ('672cc229-628e-4cc8-b050-180363f24c7c'::uuid, 60178.94, 63488.72, '[script 281] Red Vial 3/2026 cuenta 52951: importe 60.178,94 + recargo 3.309,78 al 17/11/2026 (Estado de Deuda de Rentas San Pedro)')  -- PAM Tapera 3
  ) as v(id, monto_antes, monto_nuevo, descripcion)
 where c.id = v.id and c.estado = 'pendiente' and c.monto = v.monto_antes and c.descripcion is null;

commit;
