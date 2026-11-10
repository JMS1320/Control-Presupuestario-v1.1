-- 249 · P3 (OK de JMS 10/11: «es informática todo esto… no implica ni contable ni interno. Solamente le faltaba la subcuenta dentro de otros gastos»).
-- 9 cuotas de «Otros Gastos» / «Otros Gastos USD» (vthebestpdf y Google One) sin subcuenta: su MOVIMIENTO ya decía INFORMATICA (lo puso JMS),
-- pero la cuota no, y el balance la mandaba a «sin clasificar». Sólo escribe categ. Foto: 249-foto-antes.json (las 9 tenían categ NULL).
begin;
update public.cuotas_egresos_sin_factura set categ = 'INFORMATICA' where id in ('a1aae4e4-003e-4d79-9b86-1e3d17e1346a','a33decf7-8730-42e9-9600-7798d357d187','4bfa3621-8f79-4680-9862-488689480e56','c9b9cf14-87c6-402a-9bfa-e16c35421c13','2f67656b-a357-406c-994c-21a1d3cb34a4','e4c4e110-048a-4984-a971-9e46ec000a7d','85e887a2-52ae-4e03-a2bb-bb1b7d638467','0261931c-f474-43e0-b0ed-f0a708a8a92a','2bc0c976-8a8f-4301-a6e8-28688c871f82') and categ is null;
commit;
