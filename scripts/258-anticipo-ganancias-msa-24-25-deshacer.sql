-- Deshace el 258 (258-foto-antes.json): los 2 movimientos vuelven a como estaban; borra SÓLO lo creado (ids fijos 7a2c1e0e-258…).
begin;
update public.msa_galicia set template_id = null, template_cuota_id = null, categ = null, nota_operador = '📜 Histórico jul25-ene26 — tu planilla: CATEG IMP'
 where id in ('c9ae8ed3-8598-41b5-ab5e-8764a631ae21', '01153098-2041-427a-9df9-6a67d58104a2') and nota_operador like '%[script 258]';
delete from public.cuotas_egresos_sin_factura where id in ('7a2c1e0e-2581-4c0b-9b1a-c07170000258', '7a2c1e0e-2582-4c0b-9b1a-c07170000258', '7a2c1e0e-2583-4c0b-9b1a-c07170000258');
delete from public.egresos_sin_factura where id = '7a2c1e0e-258a-4c0b-9b1a-c07170000258';
commit;
