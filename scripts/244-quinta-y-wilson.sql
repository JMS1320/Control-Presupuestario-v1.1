-- 244 · Medialunas de la reunión Benicasa (Quinta Rosello) y la fecha del adelanto de Wilson (DATOS) — DR2 + DR9.
-- OK JMS 10/11: «ok todo» → la Quinta Rosello es un grupo propio (5 hermanos, como Cotitulares): «CTA QUINTA X» (la X = a acomodar, como «CTA MA X»);
-- la cuota sigue en «Otros Gastos» con la cuenta «Gastos de representación». Y Wilson: «el sueldo cuando se pagó desde Sueldos y desde la caja Sigot
-- deben ser el mismo día» → la fecha del adelanto pasa al día del pago de la caja (21/02/26); su período no cambia.
-- Foto: scripts/244-foto-antes.json · Deshacer: 244-…-deshacer.sql.
begin;
update public.msa_galicia set contable = 'CTA QUINTA X' where id = '275381dd-8353-42e9-b494-bda02c3cd45f' and contable = 'X';
update public.cuotas_egresos_sin_factura set categ = 'GASTOS DE REPRESENTACION' where id = 'cd2a37b3-7bcc-4bfb-8675-3f6017a247d3' and categ is null;
update sueldos.pagos set fecha = '2026-02-21' where id = '778817c5-a588-4cea-9e7b-aa0a99807c5e' and fecha = '2026-03-16';
commit;
