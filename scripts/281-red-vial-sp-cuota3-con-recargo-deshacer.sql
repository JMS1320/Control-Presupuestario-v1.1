-- 281 · DESHACER: vuelve el monto original de la cuota 3/2026 de Red Vial San Pedro y vacía la descripción.
-- Sólo toca las 15 filas que marcó el script 281 (descripcion empieza con «[script 281]») y que siguen con el monto que él puso.

begin;

update public.cuotas_egresos_sin_factura c
   set monto = v.monto_antes, descripcion = null, updated_at = now()
  from (values
  ('37d7e7b2-430f-459b-ba0a-3a393e811077'::uuid, 57011.62, 60147.20),  -- MSA Anexo 52819
  ('27730787-b5ea-4ace-8de7-f6e15c3c435c'::uuid, 41175.06, 43439.65),  -- MSA Cholo 1 52937
  ('5695b7db-b979-4fe5-97d0-6351d1fd25d1'::uuid, 38007.75, 40098.14),  -- MSA Cholo 2 52938
  ('7f717500-8d5e-4fe3-8767-9f7860836217'::uuid, 53844.31, 56805.69),  -- MSA Portería Nuevo 52943
  ('b7146a2e-06af-456d-8c8d-747faf81c758'::uuid, 53844.31, 56805.69),  -- MSA Portería Viejo 52944
  ('bb2ccdd1-72d8-44aa-b4d7-cd7633c4ca7d'::uuid, 57011.62, 60147.20),  -- MSA Sánchez 52945
  ('cd60e402-249f-4689-a456-aa45e4065c38'::uuid, 53844.31, 56805.69),  -- MSA Tango Prim Leboso 52946
  ('49da117d-1b5c-48c4-8c61-0f293c97f78a'::uuid, 53844.31, 56805.69),  -- MSA Tango Parra 1 52948
  ('64d33119-b272-4963-a5db-fcbbde99056e'::uuid, 60178.94, 63488.72),  -- MSA Tango Parra 2 52950
  ('1fe3c5df-8fc6-4839-a2f8-af75ac77e7d7'::uuid, 538443.12, 568056.95),  -- PAM Casco 53017
  ('33eb48c3-c501-44b9-ae2d-4fc5fcd78225'::uuid, 83933.79, 88550.06),  -- PAM Entre Ríos 61015
  ('66699b79-f8a5-4b24-bff5-5d946f817225'::uuid, 245466.73, 258967.15),  -- PAM Ombú 52627
  ('a1915fdd-7aa1-49fb-935c-0ac8ea6fa2a3'::uuid, 57011.62, 60147.20),  -- PAM Tapera 1 52947
  ('41915c60-7b78-4102-8663-12135c63f9e2'::uuid, 57011.62, 60147.20),  -- PAM Tapera 2 52949
  ('672cc229-628e-4cc8-b050-180363f24c7c'::uuid, 60178.94, 63488.72)  -- PAM Tapera 3 52951
  ) as v(id, monto_antes, monto_nuevo)
 where c.id = v.id and c.descripcion like '[script 281]%' and c.monto = v.monto_nuevo;

commit;
