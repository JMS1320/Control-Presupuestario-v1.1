-- 273 · A-FEAT-1190 B11 (JMS 14/11: «sí, hacelo así con la huella del valor anterior»). El BALANCE PROPIO de MSA:
-- (1) foto NUEVA al 30/06/2026, versión JMS = la de su página (https://claude.ai/artifact/28UoBPnV239pu5gCe6YPNp): modelo de su planilla BAPU,
--     hacienda a PROMEDIO DE JUNIO menos el 10 % de comercialización, impuestos neutros (mismos US$ que el inicio), retiros y MEP del ejercicio.
-- (2) foto del 30/06/2025, versión JMS, corregida con el mismo criterio en 3 renglones + 1 nuevo (provisión) + el dólar (promedio de divisas BNA,
--     1.200,50), con HUELLA del valor anterior en «detalle» (y en las notas de la foto para el dólar).
-- No toca los papeles del contador ni la versión «contador». Foto: 273-foto-antes.json · Deshacer: 273-balance-propio-foto-2026-deshacer.sql
-- ✅ CORRIDO 14/11/2026 con OK de JMS. Control: la ganancia leída de la base (modelo BAPU) da US$ 260.893 = la página.
begin;
insert into public.balance_fotos (empresa, fecha_cierre, tc, tc_fuente, notas)
select 'MSA', '2026-06-30', 1477.5, 'BNA divisas promedio comprador/vendedor 30/06/26 (1.473 / 1.482)', '[script 273] Cierre 25/26 = inicio 26/27. JMS: armada en su página del 14/11 (modelo BAPU), hacienda a promedio de junio con 10 % de comercialización.'
where not exists (select 1 from public.balance_fotos where empresa = 'MSA' and fecha_cierre = '2026-06-30');
insert into public.balance_foto_valores (foto_id, renglon, version, importe, origen, detalle)
select f.id, v.renglon, 'jms', v.importe, v.origen, v.detalle from public.balance_fotos f cross join (values
 ('caja', 1766085.92, 'sistema', '[script 273] cajas de la app al cierre: General 457.212,92 · AMS 0 · Sigot 1.308.873 (papel F · Caja y bancos)'),
 ('dolares_mep', -50235000, 'sistema', '[script 273] venta de US$ 34.000 en el ejercicio (P6)'),
 ('distribucion_fondos', 64623846.86, 'manual', '[script 273] propuesta: lo que los socios se llevaron neto en el año = saldo con socios al cierre (−90.123.846,86) − al inicio (−25.500.000), papel Cuentas de socios · confirmalo en su 💬'),
 ('echeqs_cartera', 0, 'sistema', '[script 273] no quedó ninguno en cartera (el único se endosó)'),
 ('banco_galicia', -2261369.97, 'sistema', '[script 273] saldo del extracto al 30/06/26 (cierra contra el control)'),
 ('fci', 0, 'sistema', '[script 273] se rescató todo (respuesta P4)'),
 ('banco_santander', 208814.82, 'sistema', '[script 273] saldo del extracto al cierre (cierra)'),
 ('banco_provincia', -179053.43, 'sistema', '[script 273] saldo del extracto al cierre (cierra)'),
 ('ret_ganancias', 16710338.89, 'manual', '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro (lo da el contador)'),
 ('perc_ganancias', 76195.86, 'manual', '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
 ('saldo_favor_iibb', 2745365.4, 'manual', '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
 ('anticipos_ganancias', 17814224.56, 'manual', '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
 ('iva_libre_disponibilidad', 4634923.85, 'manual', '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
 ('iva_saldo_tecnico', 6702796.38, 'manual', '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro (tu criterio)'),
 ('impuesto_cheque', 13764935.13, 'manual', '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
 ('deudores_ventas', 50000850, 'sistema', '[script 273] provisión de la venta: cuota de arrendamiento de PROVINVEST facturada el 01/07/26 (en 25/26 hubo una sola cuota, la del 20/11/25). Parra estaba cobrada.'),
 ('anticipos_proveedores', 0, 'sistema', '[script 273] ningún anticipo sin facturar al cierre (papel 04.2)'),
 ('otros_creditos_comerciales', 0, 'sistema', '[script 273] Sanpa: 3 facturas en 25/26 (09/07/25, 10/11/25, 11/05/26), todas cobradas: sin saldo'),
 ('cereales', 0, 'sistema', '[script 273] cuadre de granos: inicio 6,926 t + cosecha 15,120 t (certificación AFA 28/04/26) − ventas 22,046 t = 0 al cierre (papel 1 Granos)'),
 ('sementeras_agricolas', 6966483.8, 'manual', '[script 273] PENDIENTE tuyo: falta el precio de los insumos aplicados y la tarifa de labores (papel 3 Sementeras) — mientras, neutro'),
 ('sementeras_ganaderas', 4714077.29, 'manual', '[script 273] PENDIENTE tuyo: ídem — mientras, neutro'),
 ('insumos_agricolas', 6522697.9, 'manual', '[script 273] PENDIENTE tuyo: el conteo al cierre — mientras, neutro'),
 ('insumos_ganaderos', 33100444.66, 'manual', '[script 273] PENDIENTE tuyo: el conteo al cierre — mientras, neutro'),
 ('stock_cria', 505105670.7, 'sistema', '[script 273] promedio de junio 2026 − 10 % de comercialización: 177 vacas $ 2.073.207 · 27 vqll $ 2.280.368 · 8 CUT $ 1.519.287 · 16 toros $ 7.534.166'),
 ('stock_recria', 232306875.75, 'sistema', '[script 273] promedio de junio 2026 − 10 % de comercialización: 9 toritos $ 1.733.452 · 81 vaquillonas $ 1.317.424 · 96 novillitos $ 1.414.650'),
 ('proveedores', 8826113.42, 'sistema', '[script 273] cuentas a pagar 6.486.568,02 + tarjeta 2.339.545,40 (como en tu 25: tarjeta adentro de proveedores)'),
 ('provision_gastos', 778144.76, 'sistema', '[script 273] 10 facturas de gastos del ejercicio que llegaron después (papel 05) · P8'),
 ('anticipos_clientes', 0, 'sistema', '[script 273] sin anticipos de clientes al cierre'),
 ('ganancias_a_pagar', 15123214.62, 'manual', '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
 ('sueldos_a_pagar', 1066310, 'sistema', '[script 273] sueldos devengados y no pagados al cierre (control de la plata)'),
 ('cargas_sociales', 2495547.51, 'sistema', '[script 273] SUSS de junio, vence 14/07 (template Cargas Sociales)'),
 ('cheques_pendientes', 0, 'sistema', '[script 273] ningún cheque emitido sin debitar al cierre (papel 04.1)'),
 ('impuesto_diferido', 82215901.59, 'manual', '[script 273] neutro (mismos US$ que el 30/06/25) · lo da el contador: neutro')
) as v(renglon, importe, origen, detalle)
where f.empresa = 'MSA' and f.fecha_cierre = '2026-06-30'
  and not exists (select 1 from public.balance_foto_valores x where x.foto_id = f.id and x.renglon = v.renglon and x.version = 'jms');
-- (2) la foto del 25: huella del valor anterior en «detalle»
update public.balance_foto_valores set importe = 241868150.82, origen = 'manual', detalle = '[script 273] antes: 308.090.000 (tu valuación). Ahora promedio de junio 2025 a mercado 268.742.389,80 − 10 % de comercialización', updated_at = now()
  where foto_id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and version = 'jms' and renglon = 'stock_cria' and importe = 308090000;
update public.balance_foto_valores set importe = 85101485.18, origen = 'manual', detalle = '[script 273] antes: 97.470.000 (tu valuación). Ahora promedio de junio 2025 a mercado 94.557.205,75 − 10 % de comercialización', updated_at = now()
  where foto_id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and version = 'jms' and renglon = 'stock_recria' and importe = 97470000;
update public.balance_foto_valores set importe = 0, origen = 'manual', detalle = '[script 273] antes: 92.655.408,78 («Sanpa» — caso particular). Sin saldo: las 2 facturas de Sanpa del 24/25 se facturaron y cobraron en el ejercicio', updated_at = now()
  where foto_id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and version = 'jms' and renglon = 'otros_creditos_comerciales' and importe = 92655408.78;
insert into public.balance_foto_valores (foto_id, renglon, version, importe, origen, detalle)
select '99013f8a-62f2-4358-b2ed-0a4b299788de', 'provision_gastos', 'jms', 12456000.14, 'manual', '[script 273] antes: no estaba en tu foto. Se toma la del contador (2.1.1/01/04)'
where not exists (select 1 from public.balance_foto_valores where foto_id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and version = 'jms' and renglon = 'provision_gastos');
update public.balance_fotos set tc = 1200.5, tc_fuente = 'BNA divisas promedio comprador/vendedor 30/06/25 (el de los papeles de JMS 2025)', notas = concat_ws(' · ', notas, '[script 273] antes: tc 1215 (planilla JMS — billete venta). JMS 14/11: cada punta con el promedio de divisas de su 30/06')
  where id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and tc = 1215;
do $$ begin
  if (select count(*) from public.balance_foto_valores v join public.balance_fotos f on f.id = v.foto_id where f.fecha_cierre = '2026-06-30' and f.empresa = 'MSA' and v.detalle like '[script 273]%') <> 33 then raise exception '273: la foto 2026 no tiene los 33 renglones'; end if;
  if (select count(*) from public.balance_foto_valores where foto_id = '99013f8a-62f2-4358-b2ed-0a4b299788de' and detalle like '[script 273]%') <> 4 then raise exception '273: la foto 2025 no quedó con sus 4 renglones corregidos'; end if;
  if (select tc from public.balance_fotos where id = '99013f8a-62f2-4358-b2ed-0a4b299788de') <> 1200.5 then raise exception '273: el dólar del 25 no quedó'; end if;
end $$;
commit;
