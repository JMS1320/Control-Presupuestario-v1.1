-- Deshace el 262 (262-foto-antes.json).
begin;
update public.egresos_sin_factura set nombre_referencia = 'ABL Cochera Libertad Anual', observaciones_template = null where id = '027f13d6-5d32-44fc-9d86-21bb43951df7' and observaciones_template like '%[script 262]';
update public.cuotas_egresos_sin_factura set descripcion = 'pagada por JMS desde su caja de ahorro el 30/01/26 (no pasa por las cuentas de la empresa): CTA JMS — saldo a favor de JMS que MSA le tiene que reintegrar (JMS 10/11) [script 261]'
 where id = 'd36595b1-4c46-4a00-b89a-b9b74520c2ff' and descripcion like '%[script 262]';
commit;
