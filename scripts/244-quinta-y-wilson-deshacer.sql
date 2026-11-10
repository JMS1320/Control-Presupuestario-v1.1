-- Deshace el 244 (por id, a la foto).
begin;
update public.msa_galicia set contable = 'X' where id = '275381dd-8353-42e9-b494-bda02c3cd45f' and contable = 'CTA QUINTA X';
update public.cuotas_egresos_sin_factura set categ = null where id = 'cd2a37b3-7bcc-4bfb-8675-3f6017a247d3' and categ = 'GASTOS DE REPRESENTACION';
update sueldos.pagos set fecha = '2026-03-16' where id = '778817c5-a588-4cea-9e7b-aa0a99807c5e' and fecha = '2026-02-21';
commit;
