-- 254 · Expensas Libertad, enero 2026. OK de JMS 10/11: «todo en la aplicación se lleva por la fecha de pago… la de enero se la pasás al set de MA,
-- que es el 2026». El pago del 08/01/26 (Galicia PAM CC, $ 1.560.843,11 a Consorcio Libertad 1366) estaba en el template de PAM 2025; el de MA 2026
-- tenía enero en $ 0. Pasa a la cuota de enero de MA 2026 (con su importe); la de PAM 2025 de enero queda desactivada. El movimiento conserva
-- contable LIB e interno DIST MA (PAM pagó lo de MA; los internos se revisan después). Foto: 254-foto-antes.json
begin;
update public.cuotas_egresos_sin_factura set monto = 1560843.11, descripcion = 'pagada por PAM el 08/01/26 (Galicia PAM CC); antes estaba en el template de PAM 2025 [script 254]'
 where id = 'cad7ee44-8f87-4332-990c-26649bda332e' and monto = 0;
update public.pam_galicia_cc set template_id = '6563c6a5-9a45-4051-8080-7ff51baa7993', template_cuota_id = 'cad7ee44-8f87-4332-990c-26649bda332e',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'expensa de enero-26: pasa al template de MA 2026 (se lleva por fecha de pago) [script 254]')
 where id = 'f88fab39-a92f-481d-8eb1-fbc72a96ceb4' and template_cuota_id = '244a6f92-75cd-4b17-9d4d-20e0b954a70e';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = concat_ws(' · ', nullif(descripcion, ''), 'el pago de enero-26 pasó al template de MA 2026 [script 254]')
 where id = '244a6f92-75cd-4b17-9d4d-20e0b954a70e' and estado = 'anterior';
commit;
