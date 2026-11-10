-- Deshace el 254 (254-foto-antes.json).
begin;
update public.pam_galicia_cc set template_id = '68d7b742-962e-456b-8b76-2e235924b61a', template_cuota_id = '244a6f92-75cd-4b17-9d4d-20e0b954a70e',
  nota_operador = '📜 Histórico PAM ene25-ene26 — tu planilla: CATEG FIJOS BS AS · Contable LIB · Interno DIST MA'
 where id = 'f88fab39-a92f-481d-8eb1-fbc72a96ceb4' and nota_operador like '%[script 254]';
update public.cuotas_egresos_sin_factura set estado = 'anterior', descripcion = 'Expensas Libertad — Expensas Libertad — histórico PAM' where id = '244a6f92-75cd-4b17-9d4d-20e0b954a70e' and descripcion like '%[script 254]';
update public.cuotas_egresos_sin_factura set monto = 0, descripcion = null where id = 'cad7ee44-8f87-4332-990c-26649bda332e' and descripcion like '%[script 254]';
commit;
