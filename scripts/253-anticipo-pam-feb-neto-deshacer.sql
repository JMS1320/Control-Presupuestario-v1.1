-- Deshace el 253 (253-foto-antes.json).
begin;
update public.pam_galicia_cc set template_cuota_id = '6c83e281-7899-4035-a116-24412c8a86e8', nota_operador = '[script 187] JMS 03/11 (Excel CC PAM): «anulación de otro anticipo» → devolución del anticipo debitado el 13/02'
 where id = '6464d5d4-fb4a-46fd-842a-8ca0590a5572' and nota_operador like '%[script 253]';
update public.cuotas_egresos_sin_factura set estado = 'conciliado', descripcion = null where id = '6c83e281-7899-4035-a116-24412c8a86e8' and descripcion like '%[script 253]';
commit;
