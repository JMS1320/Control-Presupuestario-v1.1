-- 256 · P2 «Anticipo Ganancias MSA» (JMS 10/11 en la v3: «son 10 que no hubo que pagar nada» · «eso ya debería estar resuelto»).
-- Las 10 cuotas en $ 0 «conciliado» sin ningún pago (dic-25 → sep-26) pasan al estado nuevo «nada_a_pagar» (script 255). Foto: 256-foto-antes.json
-- (las 10 estaban «conciliado», $ 0, sin descripción).
begin;
update public.cuotas_egresos_sin_factura set estado = 'nada_a_pagar', descripcion = 'MSA no tuvo anticipos: correctamente en $ 0 (JMS 10/11) [script 256]'
 where id in ('38910bae-96dd-4aa7-aad0-e3b0f655a97c','86902274-6741-4259-919e-8c819fcad7dd','42e65249-aa2b-4970-8fae-cb4672f39907','41397c46-fb30-4ad6-995e-90ef11303f78','84ad4821-f74d-4873-baa2-fb51bbe8d929','ef379418-8e5f-42b9-9210-56239d970477','40db2902-2f28-497e-8ab2-3c0ba014a8f8','7445388e-aa09-4f90-85aa-261554db6bec','69fbaa8e-817e-4c7d-900c-7ae387d1636b','be7bac33-de79-4a93-9598-5cc4ef10cec4') and estado = 'conciliado' and monto = 0;
commit;
