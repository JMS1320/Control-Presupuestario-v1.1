-- 255 · A-FEAT-1587: estado nuevo «nada_a_pagar» para la cuota que CORRECTAMENTE quedó en $ 0 (JMS 10/11: «cómo dejamos registrado que
-- correctamente no hubo nada que pagar… desactivado no es una referencia de lo que sucedió»; nombre elegido «Nada a pagar»; «eso ya debería
-- estar resuelto»). Estructura: se rehace el CHECK de estado con la MISMA lista + 'nada_a_pagar'. Aviso previo en ENTRE-DESARROLLADORES.
-- No toca datos, RLS, roles ni permisos.
begin;
alter table public.cuotas_egresos_sin_factura drop constraint cuotas_egresos_sin_factura_estado_check;
alter table public.cuotas_egresos_sin_factura add constraint cuotas_egresos_sin_factura_estado_check check (estado::text = any (array[
  'pendiente', 'debito', 'pagar', 'preparado', 'pagado', 'credito', 'conciliado', 'desactivado', 'anterior', 'programado', 'nada_a_pagar']::text[]));
commit;
