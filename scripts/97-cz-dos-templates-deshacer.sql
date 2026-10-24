-- Deshace 97-cz-dos-templates.sql: vuelve a un solo template «CZ Ganadera» con todas sus cuotas.
begin;
update public.msa_galicia set template_id = 'a9762127-f643-464f-a5f4-20aa15042e0d'
where id = 'fc77cd6b-1759-4622-b03a-eddd2b3da2f2';
update public.cuotas_egresos_sin_factura set egreso_id = 'a9762127-f643-464f-a5f4-20aa15042e0d'
where egreso_id = (select id from public.egresos_sin_factura where nombre_referencia = 'Guías Municipales' and responsable = 'MSA');
-- ⚠️ Si después del script se cargaron guías nuevas, también vuelven a CZ Ganadera (es lo correcto al deshacer).
delete from public.egresos_sin_factura where nombre_referencia = 'Guías Municipales' and responsable = 'MSA';
update public.egresos_sin_factura
set nombre_referencia = 'CZ Ganadera', proveedor = null, nombre_quien_cobra = null, cuenta_agrupadora = 'Comercializacion'
where id = 'a9762127-f643-464f-a5f4-20aa15042e0d';
commit;
