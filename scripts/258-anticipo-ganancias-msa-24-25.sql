-- 258 · D1 de «Decisiones P2» (OK de JMS 10/11: «la campaña anterior, anticipos 24-25, dieron a pagar dentro del ejercicio: la 8 dio eso, la 9 se
-- compensó, con lo cual sería nada a pagar, y la 10 se pagó en el 9 por ese monto y evidentemente no hubo más. Así que eso quedaría cerrado»).
-- Template nuevo «Anticipo Ganancias MSA» 24/25 (no existía) con 3 cuotas: 8/10 pagada (15/07/25) · 9/10 compensada con IVA → Nada a pagar ·
-- 10/10 pagada (09/09/25, el saldo después de compensar). Los 2 pagos del Galicia MSA CC (estaban sin vincular, tramo histórico) se vinculan.
-- No se toca el «detalle» de los movimientos. Foto: 258-foto-antes.json. Deshacer: 258-…-deshacer.sql (borra SÓLO lo que crea: ids fijos).
begin;
insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, categ, centro_costo, responsable, activo, año, pago_anual,
  cuenta_agrupadora, tipo_template, es_bidireccional, solo_conciliacion, es_multi_cuenta, periodicidad, aplica_generacion, tipo, actualizacion_proximas_cuotas, observaciones_template)
values ('7a2c1e0e-258a-4c0b-9b1a-c07170000258', 'b88c61a4-f2fb-4ffe-9814-d21f7864a978', 'Anticipo Ganancias MSA', 'ARCA', '33693450239', 'Impuestos ARCA', 'Estructura', 'MSA', true, '24/25', false,
  'Impuestos General', 'fijo', false, false, false, 'bianual', false, 'egreso', 'false', '[script 258] plan de anticipos 24/25: en el ejercicio 25/26 cayeron el 8/10, el 9/10 (compensado con IVA) y el 10/10 (JMS 10/11)');
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_estimada, fecha_vencimiento, monto, estado, descripcion, tipo_movimiento, medio_pago) values
 ('7a2c1e0e-2581-4c0b-9b1a-c07170000258', '7a2c1e0e-258a-4c0b-9b1a-c07170000258', 8, '2025-07-15', '2025-07-15', 2067776.32, 'conciliado', 'Anticipo 8/10 (VEP 1485941516) [script 258]', 'egreso', 'banco'),
 ('7a2c1e0e-2582-4c0b-9b1a-c07170000258', '7a2c1e0e-258a-4c0b-9b1a-c07170000258', 9, '2025-08-13', '2025-08-13', 0, 'nada_a_pagar', 'Anticipo 9/10 compensado con IVA disponible (no se pagó; JMS 10/11) [script 258]', 'egreso', 'banco'),
 ('7a2c1e0e-2583-4c0b-9b1a-c07170000258', '7a2c1e0e-258a-4c0b-9b1a-c07170000258', 10, '2025-09-09', '2025-09-09', 271066.38, 'conciliado', 'Anticipo 10/10: el saldo después de compensar (VEP 1515760162) [script 258]', 'egreso', 'banco');
update public.msa_galicia set template_id = '7a2c1e0e-258a-4c0b-9b1a-c07170000258', template_cuota_id = '7a2c1e0e-2581-4c0b-9b1a-c07170000258', categ = 'Impuestos ARCA',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'vinculado a Anticipo Ganancias MSA 24/25, cuota 8/10 [script 258]') where id = 'c9ae8ed3-8598-41b5-ab5e-8764a631ae21' and template_cuota_id is null;
update public.msa_galicia set template_id = '7a2c1e0e-258a-4c0b-9b1a-c07170000258', template_cuota_id = '7a2c1e0e-2583-4c0b-9b1a-c07170000258', categ = 'Impuestos ARCA',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'vinculado a Anticipo Ganancias MSA 24/25, cuota 10/10 [script 258]') where id = '01153098-2041-427a-9df9-6a67d58104a2' and template_cuota_id is null;
commit;
