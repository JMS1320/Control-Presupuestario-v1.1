-- Deshace el [script 320].
begin;
update productivo.mediciones_insumo set cantidad = 6000, notas = split_part(notas, ' · [script 320]', 1) where id = '615fa41f-f5b4-495b-8b04-d517acab0983';
update productivo.movimientos_insumos set fecha = '2026-10-06', observaciones = split_part(observaciones, ' · [script 320]', 1) where id = 'ecec03f2-345f-46c8-adc1-b4cf0ab84615';
delete from public.presupuesto_variables where fundamento like '[script 320]%';
update public.revisiones set estado = 'abierta', resuelto_por = null, resuelto_at = null, resolucion = null
 where id in ('4f709726-8fe5-4d35-95e1-c71ee18f6b49', 'dc74944b-66e6-49b0-87bc-66f35817f7e7') and resolucion like '[script 320]%';
commit;
