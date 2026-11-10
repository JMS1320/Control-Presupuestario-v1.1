-- 263 · JMS 11/11 sobre «Extracto sin categoría ni vínculo»:
--  (1) «es una venta de dólares… habíamos dicho que eso iba a la venta de dólares»: la salida de US$ 34.000 de la CC dólares MSA a Galicia
--      Securities (01/08/25) toma la categoría «Compra / Venta de dólares», como ya la tiene su otra punta en pesos («Rescate Fima» del
--      04/08/25, $ 45.431.590,72, Galicia MSA CC, detalle «Venta Dolares via GSEC FIMA»).
--  (2) «eso debería estar vinculado, es una pavada»: los 12 «SU PAGO EN PESOS / EN USD» de la VISA MSA de jul-25 a ene-26 toman la
--      categoría «Tarjetas MSA», como ya la tienen los de feb-26 en adelante (el pago del resumen; la otra punta es el débito del Galicia).
-- Sólo se llena categ y detalle, que estaban vacíos (foto: 263-foto-antes.json). El estado no cambia.
begin;
update msa.cc_usd set categ = 'Compra / Venta de dólares',
  detalle = 'Venta Dolares via GSEC FIMA — el ingreso en pesos es el «Rescate Fima» del 04/08/25, $ 45.431.590,72 (Galicia MSA CC) [script 263]'
 where id = '1af536c2-4df3-4541-985e-16b3319acb2d' and categ is null and detalle is null;
update msa.tarjeta_visa_business set categ = 'Tarjetas MSA', detalle = 'Pago del resumen de la tarjeta (la otra punta es el débito del Galicia) [script 263]'
 where id in ('1144f2d1-8216-4f37-be9d-5da5d96ff92e','23ff77d7-5756-44b0-b93b-d26f38f79c78','af081d55-9241-4203-9aa1-ce395d7896c1','2ccdf2c2-88d8-4563-b929-072233cfb23a','25573cac-d27f-4cb3-8a7b-40d2b7b29c61','2bb3f8e1-7a95-4f08-a4fc-d4812e88f105','d19e345e-71ec-4bcd-826e-076df29ddb19','a2f74034-dc13-4a63-8f67-71aa4aa2ee08','0ba144ee-1b83-41d9-b119-aecd2d1a2010','21a11f30-ba5c-4c13-b187-332bad44662f','d31ca148-0ca9-4688-ae38-bb1d00b3a130','1aeec023-9459-42a1-8a45-68b0b98ab225') and categ is null and detalle is null;
commit;
