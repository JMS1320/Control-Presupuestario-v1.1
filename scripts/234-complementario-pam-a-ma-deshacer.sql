-- Deshace el 234.
begin;
update public.egresos_sin_factura set responsable = 'PAM' where id in ('c17d666a-82af-41a6-8279-022ccdb56476','79b2c3b0-a6bb-48d4-b4d7-952f926162ff') and responsable = 'MA';
commit;
