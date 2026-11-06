-- Deshacer del 227: vuelve las 15 cuotas a fecha_estimada 05/09 y sin vencimiento (como estaban), y saca del mail sólo los
-- vínculos marcados «[script 227]».
begin;
update public.cuotas_egresos_sin_factura
   set fecha_vencimiento = null, fecha_estimada = '2026-09-05', updated_at = now()
 where id in ('37d7e7b2-430f-459b-ba0a-3a393e811077','27730787-b5ea-4ace-8de7-f6e15c3c435c','5695b7db-b979-4fe5-97d0-6351d1fd25d1',
   '7f717500-8d5e-4fe3-8767-9f7860836217','b7146a2e-06af-456d-8c8d-747faf81c758','bb2ccdd1-72d8-44aa-b4d7-cd7633c4ca7d',
   '49da117d-1b5c-48c4-8c61-0f293c97f78a','64d33119-b272-4963-a5db-fcbbde99056e','cd60e402-249f-4689-a456-aa45e4065c38',
   '1fe3c5df-8fc6-4839-a2f8-af75ac77e7d7','33eb48c3-c501-44b9-ae2d-4fc5fcd78225','66699b79-f8a5-4b24-bff5-5d946f817225',
   'a1915fdd-7aa1-49fb-935c-0ac8ea6fa2a3','41915c60-7b78-4102-8663-12135c63f9e2','672cc229-628e-4cc8-b050-180363f24c7c')
   and fecha_vencimiento = '2026-09-11';
update public.mails_registro
   set vinculos = (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(vinculos) e where coalesce(e->>'que','') not like '[script 227]%'),
       updated_at = now()
 where id = '14c543d2-f883-4410-a374-dee9174abf90';
commit;
