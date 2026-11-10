-- 262 · JMS 10/11: «lo que pagué yo fue cochera Duhau, ojo» · «sí, renombralo, lo reintegra MA». El template «ABL Cochera Libertad Anual»
-- (responsable «PAM/MA/Duhau», detalle «Pago JMS desde su CA el 30/01») es el ABL de la cochera de DUHAU → se renombra, y la nota de la cuota
-- (script 261) se corrige: la reintegra MA, no MSA. No se toca el «detalle» (es del usuario). Foto: 262-foto-antes.json.
begin;
update public.egresos_sin_factura set nombre_referencia = 'ABL Cochera Duhau Anual',
  observaciones_template = concat_ws(' · ', nullif(observaciones_template, ''), 'se llamaba «ABL Cochera Libertad Anual»: es la cochera de Duhau (JMS 10/11) [script 262]')
 where id = '027f13d6-5d32-44fc-9d86-21bb43951df7' and nombre_referencia = 'ABL Cochera Libertad Anual';
update public.cuotas_egresos_sin_factura set descripcion = 'ABL de la cochera de DUHAU pagado por JMS desde su caja de ahorro el 30/01/26 (no pasa por las cuentas de la empresa): CTA JMS — saldo a favor de JMS que le reintegra MA (JMS 10/11) [script 261] [script 262]'
 where id = 'd36595b1-4c46-4a00-b89a-b9b74520c2ff' and descripcion like '%[script 261]';
commit;
