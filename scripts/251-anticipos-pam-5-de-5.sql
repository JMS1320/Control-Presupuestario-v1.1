-- 251 · Anticipos de Ganancias / Bs Pers de PAM 2025 (A-DAT-100). OK de JMS 10/11: «1/5… vinculalo. 2/5 hasta 5/5… adelante, está todo ok…
-- quedarían 5 de 5, cada cual en su cuota». Template 54780a9f «Anticipo Ganancias / Bs Pers PAM».
--   1/5 ago: pago 14/08/25 Galicia PAM CA $ 86.000,71 (IMPAFIP) → cuota ago (estaba en $ 0, sin vínculo)
--   2/5 oct: pago 07/10/25 Galicia PAM CC $ 86.079,54 (Transf. Afip) → cuota oct (estaba en $ 0, sin vínculo)
--   3/5 dic: pago 15/01/26 Galicia PAM CC $ 88.444,57 (pagado tarde, con intereses) estaba en una cuota de ENERO → pasa a la cuota de dic;
--            la de enero (no existe anticipo en enero) queda desactivada. 4/5 feb y 5/5 abr ya estaban bien.
-- No se toca el «detalle» de ningún movimiento (es del usuario). Foto: 251-foto-antes.json.
begin;
update public.cuotas_egresos_sin_factura set monto = 86000.71, descripcion = 'Anticipo 1/5: pago 14/08/25 Galicia PAM CA (IMPAFIP) [script 251]' where id = 'ca01baee-c760-4337-8fab-2f7903b16a5a' and monto = 0;
update public.cuotas_egresos_sin_factura set monto = 86079.54, descripcion = 'Anticipo 2/5: pago 07/10/25 Galicia PAM CC (Transf. Afip) [script 251]' where id = '84f78b10-f1ca-4cef-84db-b00e87c52229' and monto = 0;
update public.cuotas_egresos_sin_factura set monto = 88444.57, descripcion = 'Anticipo 3/5: pagado tarde el 15/01/26 con intereses (Galicia PAM CC, VEP 1572825690) [script 251]' where id = '13174830-0253-45ed-991f-7f9f89d40773' and monto = 0;
update public.cuotas_egresos_sin_factura set estado = 'desactivado', monto = 0, descripcion = 'no hay anticipo en enero: el pago del 15/01/26 es el 3/5 (diciembre) y pasó a su cuota [script 251]' where id = 'e507c022-1d9c-4a4c-a751-5886db4a0942' and estado = 'conciliado';
update public.pam_galicia set template_id = '54780a9f-3f74-4559-9e2c-481e6757f1bc', template_cuota_id = 'ca01baee-c760-4337-8fab-2f7903b16a5a', categ = 'Impuestos ARCA',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'anticipo 1/5 vinculado a su cuota (ago-25) [script 251]') where id = '4d00121d-50de-49d0-a1b7-ace79f49cb6c' and template_cuota_id is null;
update public.pam_galicia_cc set template_id = '54780a9f-3f74-4559-9e2c-481e6757f1bc', template_cuota_id = '84f78b10-f1ca-4cef-84db-b00e87c52229', categ = 'Impuestos ARCA',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'anticipo 2/5 vinculado a su cuota (oct-25) [script 251]') where id = '4133df11-7377-4557-a99e-72b4299cbc40' and template_cuota_id is null;
update public.pam_galicia_cc set template_cuota_id = '13174830-0253-45ed-991f-7f9f89d40773', categ = 'Impuestos ARCA',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'anticipo 3/5 (diciembre) pagado tarde con intereses: pasa de la cuota de enero a la de diciembre [script 251]') where id = 'd7c4df9a-683e-4b6e-ad6e-1a10ccaf3c15' and template_cuota_id = 'e507c022-1d9c-4a4c-a751-5886db4a0942';
commit;
