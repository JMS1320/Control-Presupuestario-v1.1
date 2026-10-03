-- 76 · CARGA de las fotos MSA 30/06/2024 (JMS) y 30/06/2025 (contador + JMS)  A-FEAT-1190 · 2026-10-03
-- Generado desde `BAPU JMS USS 2025.xlsx` (solapa NOTAS; SIN las filas de PAM: Galicia PAM y FCI PAM, OK del usuario)
-- y `Borrador - Balance hist y axi 2025.xlsx` (del contador). Datos NUEVOS: no pisa nada.
-- 🔙 Deshacer: delete from public.balance_fotos where empresa='MSA' and fecha_cierre in ('2024-06-30','2025-06-30');
begin;
insert into public.balance_fotos (empresa, fecha_cierre, tc, tc_fuente, notas) values
  ('MSA','2024-06-30',1365,'planilla JMS — billete venta','Foto de inicio: sólo versión JMS (de la planilla 2025, columna 2024). En la planilla sumaba PAM: se sacó Galicia PAM.'),
  ('MSA','2025-06-30',1215,'planilla JMS — billete venta','Cierre 24/25 = inicio 25/26. Contador: borrador hist. 2025. JMS: solapa NOTAS sin PAM (Galicia PAM y FCI PAM).')
on conflict (empresa, fecha_cierre) do nothing;
insert into public.balance_foto_valores (foto_id, renglon, version, importe, origen, detalle) values
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'caja','jms',682722.7,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'banco_galicia','jms',18499417.13,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'banco_santander','jms',35150.48,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'banco_provincia','jms',3360.93,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'ret_ganancias','jms',8944954.76,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'saldo_favor_iibb','jms',1342.34,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'anticipos_ganancias','jms',3846698.64,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'iva_libre_disponibilidad','jms',5389859.5,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'iva_saldo_tecnico','jms',2730598.82,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'impuesto_cheque','jms',4454609.88,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'deudores_ventas','jms',2448367.01,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'otros_creditos_comerciales','jms',81457200,'planilla','«Sanpa» — caso particular (planilla JMS)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'cereales','jms',78378977.6,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'sementeras_ganaderas','jms',6454743.75,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'insumos_agricolas','jms',28923292.08,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'insumos_ganaderos','jms',9876195,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'stock_cria','jms',197625000,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'stock_recria','jms',52714000,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'proveedores','jms',23571319.29,'planilla','incluye tarjeta VISA y saldo USS Acren (planilla JMS)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'ganancias_a_pagar','jms',29622717.96,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'cargas_sociales','jms',1344674.56,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2024-06-30'),'impuesto_diferido','jms',38029617.62,'planilla',null)
on conflict (foto_id, renglon, version) do nothing;
insert into public.balance_foto_valores (foto_id, renglon, version, importe, origen, detalle) values
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'dolares_mep','jms',28811048.46,'planilla','en la planilla: US$ 23.712,80 × 1.215'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'distribucion_fondos','jms',11200207,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'banco_galicia','jms',832605.05,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'fci','jms',23244019.93,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'ret_ganancias','jms',13577503.78,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'perc_ganancias','jms',61910.75,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'saldo_favor_iibb','jms',2230667.45,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'anticipos_ganancias','jms',14474434.24,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'iva_libre_disponibilidad','jms',3765973.66,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'iva_saldo_tecnico','jms',5446163.83,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'impuesto_cheque','jms',11184300.93,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'otros_creditos_comerciales','jms',92655408.78,'planilla','«Sanpa» — caso particular (planilla JMS)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'cereales','jms',2045386.32,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'sementeras_agricolas','jms',5660415.43,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'sementeras_ganaderas','jms',3830287.5,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'insumos_agricolas','jms',5299830,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'insumos_ganaderos','jms',26894811.38,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'stock_cria','jms',308090000,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'stock_recria','jms',97470000.0,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'proveedores','jms',4431467.73,'planilla','incluye tarjeta VISA y saldo USS Acren (planilla JMS)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'ganancias_a_pagar','jms',12287931.74,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'cargas_sociales','jms',3415867.25,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'cheques_pendientes','jms',6064989.95,'planilla',null),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'impuesto_diferido','jms',66802158.96,'planilla',null)
on conflict (foto_id, renglon, version) do nothing;
insert into public.balance_foto_valores (foto_id, renglon, version, importe, origen, detalle) values
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'caja','contador',9903617.62,'planilla','1.1.1/01/01 Caja (cash)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'caja_dolares','contador',932000,'planilla','1.1.1/01/03 CAJA DOLARES'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'banco_santander','contador',7204.86,'planilla','1.1.1/02/01 Banco Santander Rio'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'banco_provincia','contador',15298.25,'planilla','1.1.1/02/02 Banco de la Provincia de Buenos Aires'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'cheques_pendientes','contador',6064989.95,'planilla','el contador lo resta en bancos (1.1.1/02/03); acá va como deuda'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'fci','contador',23244019.93,'planilla','1.1.1/02/06 Fondo comun de Inversión'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'banco_galicia','contador',832605.05,'planilla','1.1.1/02/07 Banco Galicia'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'banco_galicia_usd','contador',40776898.95,'planilla','1.1.1/02/09 Banco Galicia cta. USD'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'anticipos_ganancias','contador',14474434.24,'planilla','1.1.4/01/04 Anticipo de Ganancias'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'ret_ganancias','contador',13577503.78,'planilla','1.1.4/01/05 Retenciones Impuesto a las Ganancias'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'perc_ganancias','contador',61910.75,'planilla','1.1.4/01/14 Percepciones Imp. a las ganancias'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'anticipos_proveedores','contador',31728000.07,'planilla','1.1.4/02/02 Anticipos a Proveedores'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'cuenta_socios','contador',45905575.52,'planilla','1.1.4/02/05 Socio Placido Martinez'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'iva_saldo_tecnico','contador',5446163.83,'planilla','1.1.4/03/01 IVA Saldo a Favor Tecnico(vat credit)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'iva_libre_disponibilidad','contador',3765973.66,'planilla','1.1.4/03/03 IVA Saldo a Favor Libre Disponibilidad(vat credit)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'impuesto_cheque','contador',11184300.93,'planilla','1.1.4/03/06 Impuesto al Cheque (bank tax credit)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'saldo_favor_iibb','contador',2230667.45,'planilla','1.1.4/03/09 Saldo a Favor Ingresos Brutos'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'cereales','contador',2045386.32,'planilla','1.1.5/02/00 SOJA'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'equinos','contador',536919.86,'planilla','1.1.5/04/02 Equinos'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'stock_cria','contador',255479054.9,'planilla','1.2.2/05/01 VACAS DE CRÍA'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'sementeras_agricolas','contador',4738332.1,'planilla','1.2.5/01/04 SEMENTERAS AGRICULTURA'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'proveedores','contador',3543793.46,'planilla','2.1.1/01/01 Proveedores en Cta.Cte. (accounts payable-trade)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'provision_gastos','contador',12456000.14,'planilla','2.1.1/01/04 Provision para gastos'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'tarjetas','contador',887674.27,'planilla','2.1.1/01/10 TARJETA VISA BUSSINES GALICIA'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'cargas_sociales','contador',3415867.25,'planilla','2.1.2/02/01 SUSS a pagar (social security payable)'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'cuota_solidaria','contador',90621.62,'planilla','2.1.2/02/04 Cuota Solidaria a pagar'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'ganancias_a_pagar','contador',12287931.74,'planilla','2.1.3/02/02 Impuesto a las Ganancias a pagar'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'impuesto_diferido','contador',66802158.96,'planilla','2.2.1/03/00 Pasivo por impuesto diferido'),
  ((select id from public.balance_fotos where empresa='MSA' and fecha_cierre='2025-06-30'),'bienes_uso_neto','contador',417164580.02,'planilla','1.2.2 inmuebles, maquinarias, rodados, instalaciones, herramientas, muebles — neto de amortizaciones')
on conflict (foto_id, renglon, version) do nothing;
commit;
