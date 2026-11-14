-- Deshace el 273 (273-foto-antes.json): borra SÓLO lo que creó el 273 y devuelve los 3 renglones y el dólar del 25 a su valor anterior.
begin;
delete from public.balance_foto_valores where detalle like '[script 273]%' and foto_id in (select id from public.balance_fotos where empresa = 'MSA' and fecha_cierre = '2026-06-30');
delete from public.balance_fotos where empresa = 'MSA' and fecha_cierre = '2026-06-30' and notas like '[script 273]%' and not exists (select 1 from public.balance_foto_valores v where v.foto_id = balance_fotos.id);
update public.balance_foto_valores set importe = 308090000, origen = 'planilla', detalle = null where foto_id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and version = 'jms' and renglon = 'stock_cria' and detalle like '[script 273]%';
update public.balance_foto_valores set importe = 97470000.0, origen = 'planilla', detalle = null where foto_id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and version = 'jms' and renglon = 'stock_recria' and detalle like '[script 273]%';
update public.balance_foto_valores set importe = 92655408.78, origen = 'planilla', detalle = '«Sanpa» — caso particular (planilla JMS)' where foto_id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and version = 'jms' and renglon = 'otros_creditos_comerciales' and detalle like '[script 273]%';
delete from public.balance_foto_valores where foto_id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and version = 'jms' and renglon = 'provision_gastos' and detalle like '[script 273]%';
update public.balance_fotos set tc = 1215, tc_fuente = 'planilla JMS — billete venta', notas = 'Cierre 24/25 = inicio 25/26. Contador: borrador hist. 2025. JMS: solapa NOTAS sin PAM (Galicia PAM y FCI PAM).' where id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and notas like '%[script 273]%';
commit;
