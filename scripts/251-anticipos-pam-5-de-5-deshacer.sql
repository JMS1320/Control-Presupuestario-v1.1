-- Deshace el 251: todo a la foto (251-foto-antes.json).
begin;
update public.pam_galicia set template_id = null, template_cuota_id = null, categ = null, nota_operador = '📜 Histórico PAM ene25-ene26 — tu planilla: CATEG IMP' where id = '4d00121d-50de-49d0-a1b7-ace79f49cb6c' and nota_operador like '%[script 251]';
update public.pam_galicia_cc set template_id = null, template_cuota_id = null, categ = null, nota_operador = '📜 Histórico PAM ene25-ene26 — tu planilla: CATEG IMP' where id = '4133df11-7377-4557-a99e-72b4299cbc40' and nota_operador like '%[script 251]';
update public.pam_galicia_cc set template_cuota_id = 'e507c022-1d9c-4a4c-a751-5886db4a0942', categ = null, nota_operador = '📜 Histórico PAM ene25-ene26 — tu planilla: CATEG IMP · [script 187] JMS 03/11 (Excel CC PAM): «anticipo ok»' where id = 'd7c4df9a-683e-4b6e-ad6e-1a10ccaf3c15' and nota_operador like '%[script 251]';
update public.cuotas_egresos_sin_factura set monto = 0, descripcion = null where id in ('ca01baee-c760-4337-8fab-2f7903b16a5a', '84f78b10-f1ca-4cef-84db-b00e87c52229', '13174830-0253-45ed-991f-7f9f89d40773') and descripcion like '%[script 251]';
update public.cuotas_egresos_sin_factura set estado = 'conciliado', monto = 88444.57, descripcion = null where id = 'e507c022-1d9c-4a4c-a751-5886db4a0942' and descripcion like '%[script 251]';
commit;
