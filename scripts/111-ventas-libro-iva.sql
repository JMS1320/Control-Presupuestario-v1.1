-- =====================================================================================
-- 111 · LAS 9 VENTAS PRESENTADAS DEL EJERCICIO 25/26 QUE LA APP NO TENÍA — A-DAT-88
-- =====================================================================================
-- Pedido de JMS 2026-10-27: «carga las 9 ventas… cargalas viendo los PDF, sino probablemente
-- haya errores». Cada fila sale del PDF de su carpeta «Ventas» del archivo digital (Drive),
-- contrastada con el libro IVA presentado (libro_iva_periodo_AAAAMM_original.zip →
-- comprobantes_ventas.csv) y con el cobro en el banco.
--
-- Convenciones de la app que se respetan (las mismas de las ventas ya cargadas):
--   · liquidación de hacienda (cuenta de venta y líquido producto) = tipo 60, como Genta 11-75880
--     (el libro IVA la informa con código 180); total = neto gravado + IVA; las retenciones de
--     IIBB impresas van en ret_iibb y las de Ganancias (RG 830) en retenciones_recibidas.
--   · liquidación primaria de granos = tipo 332, como las de AFA.
--   · el cobro se ata al movimiento del banco con comprobante_venta_id; el DETALLE que escribió
--     JMS en el movimiento NO se toca.
--   · DDJJ = «DDJJ OK»: las 9 están en un libro IVA ya presentado.
-- Marca para deshacer: «[script 111]» en datos_adicionales / observaciones / notas.
-- Deshacer: scripts/111-ventas-libro-iva-deshacer.sql
-- =====================================================================================
begin;

-- ── 0 · Contrapartes (regla 👥: upsert, nunca sólo UPDATE) ──────────────────────────
insert into public.proveedores (cuit, razon_social, es_cliente, es_proveedor, notas)
select v.cuit, v.rs, true, v.prov, '[script 111] alta al cargar las ventas del libro IVA 25/26'
from (values
  ('30500049460', 'SANCOR COOPERATIVA DE SEGUROS LIMITADA', true),   -- tiene póliza 464557-902 en compras
  ('20122086489', 'PARRA ROBERTO JOSE',                     false),
  ('30576703119', 'SAENZ VALIENTE BULLRICH Y CIA SA',        false)
) v(cuit, rs, prov)
where not exists (select 1 from public.proveedores p where p.cuit = v.cuit);
update public.proveedores set es_cliente = true
where cuit in ('30500049460','20122086489','30576703119') and es_cliente is distinct from true;

-- ── 1 · Las 9 ventas ────────────────────────────────────────────────────────────────
insert into msa.comprobantes_venta (
  id, fecha_liquidacion, tipo_comprobante, punto_venta, numero_desde, nro_comprobante, coe,
  cuit_cliente, denominacion_cliente, "año_contable", mes_contable, ddjj_iva, moneda, modo_precio,
  subtotal_neto, comision_neto, imp_neto_gravado, imp_neto_no_gravado, imp_op_exentas, alicuota_iva, iva,
  imp_total, ret_iva, ret_iibb, cuenta_contable, nro_cuenta, centro_costo, estado, actividad,
  grano, toneladas, peso_kg, precio_pesos, fecha_acreditacion, cabezas, hacienda_lineas, plazos,
  datos_adicionales, correcciones)
values
-- V1 · Sanpa FC A 10-17 · arrendamiento Rojas 25/26 cuota 1 de 3 · exenta
('a7dfdce5-5d26-4070-bde1-e82d5b8678ca','2025-07-09',1,10,17,'00010-00000017',null,
 '30712200622','Sanpa Semillas SA',2025,7,'DDJJ OK','PES','pesos',
 0,0,0,0,57027626.70,null,0, 57027626.70,0,0,'ARRENDAMIENTOS Venta','4109','Agricultura Rojas','conciliado',null,
 null,null,null,null,null,null,null,null,
 'Arrendamiento Agricola Campaña 2025/2026 - Cuota 1 de 3 [script 111]',
 '{"version":1,"origen":"script 111 — leído por Claude del PDF","archivo":"Ventas - 07-09 - Arrendamiento SANPA - Campaña 2025-2026 - Cuota 1 de 3.pdf","drive_id":"1JtCdrrmrPuE9tM1_0Daip6dEsOJtvgrv","libro_iva":{"periodo":"2025-07","total":57027626.70,"estado":"coincide"}}'),

-- V2 · Sancor · liquidación primaria de granos (COE 330229066836) · soja 6.832 kg · CANJE: pago total en especie
('7b1c839b-29e7-4e5b-919f-b54347fc88b4','2025-07-22',332,null,null,'29066836','330229066836',
 '30500049460','SANCOR COOPERATIVA DE SEGUROS LIMITADA',2025,7,'DDJJ OK','PES','pesos',
 2312632.00,0,2312632.00,0,0,10.50,242826.36, 2555458.36,0,0,'VENTA SOJA','410101',null,'cobrado','agricultura',
 'SOJA',6.832,6832,338500,'2025-07-22',null,null,null,
 'Canje: pago total en especie (soja entregada en AFA, Rio Tala). Compensa la póliza Sancor 464557-902 del 24/07/2025 ($2.469.357,50); quedan $86.100,86 a favor de MSA [script 111]',
 '{"version":1,"origen":"script 111 — leído por Claude del PDF","archivo":"07-22 - SANCOR Liq .pdf","drive_id":"1Wgy09zGSY41r6CszVNRPA-fIMMKS_1Ca","libro_iva":{"periodo":"2025-07","total":2555458.36,"estado":"coincide"}}'),

-- V3 · Sanpa FC A 10-18 · arrendamiento Rojas 25/26 cuota 2 de 3 · exenta
('5375d919-1a49-44c0-8026-f2756ececb62','2025-11-10',1,10,18,'00010-00000018',null,
 '30712200622','Sanpa Semillas SA',2025,11,'DDJJ OK','PES','pesos',
 0,0,0,0,66512918.34,null,0, 66512918.34,0,0,'ARRENDAMIENTOS Venta','4109','Agricultura Rojas','conciliado',null,
 null,null,null,null,null,null,null,null,
 'Arrendamiento Agricola Campaña 2025-2026 - Cuota 2 de 3 [script 111]',
 '{"version":1,"origen":"script 111 — leído por Claude del PDF","archivo":"11-10 - Sanpa.pdf","drive_id":"1Zs0ZUybKjh5IOugvGCyuj-lR2_56hhK_","libro_iva":{"periodo":"2025-11","total":66512918.34,"estado":"coincide"}}'),

-- V4 · Provinvest FCE A 10-8 (cód. 201) · arrendamiento Nazarenas 25/26 cuota 1 de 2 · exenta
('4cac5636-949d-4843-8889-58ae53400f3c','2025-11-20',201,10,8,'00010-00000008',null,
 '33710346939','PROVINVEST S.A.',2025,11,'DDJJ OK','PES','pesos',
 0,0,0,0,46290636.93,null,0, 46290636.93,0,0,'ARRENDAMIENTOS Venta','4109','Nazarenas','conciliado',null,
 null,null,null,null,null,null,null,null,
 'Arrendamiento Agricola Campaña 2025/2026 Cuota 1 de 2 (Ceibos) [script 111]',
 '{"version":1,"origen":"script 111 — leído por Claude del PDF","archivo":"11-20 - MSA Arrendamiento Ceibos.pdf","drive_id":"1uyEGr6CoxETw-o1YeV8nf3TYt-8gc6Eb","libro_iva":{"periodo":"2025-11","total":46290636.93,"estado":"coincide"}}'),

-- V5 · Parra FC A 10-19 · venta de la pick up VW Amarok AF236VG · IVA 10,5 % · ⏳ COBRO A CONFIRMAR CON JMS
('8a6546e4-9680-4f85-a020-c9c2fa593c9d','2025-11-26',1,10,19,'00010-00000019',null,
 '20122086489','PARRA ROBERTO JOSE',2025,11,'DDJJ OK','PES','pesos',
 22624434.49,0,22624434.49,0,0,10.50,2375565.62, 25000000.11,0,0,'VENTA BIENES DE USO','4102',null,'a cobrar',null,
 null,null,null,null,null,null,null,null,
 'Pick up VW Amarok Confortline 4x4 V6 3.0 dominio AF236VG — el cobro no aparece en Galicia: a confirmar con JMS [script 111]',
 '{"version":1,"origen":"script 111 — leído por Claude del PDF","archivo":"11-26 - MSA Amarok.pdf","drive_id":"1YcC4Dn6toi4TQVvRrsQvINvaJG6vRX4V","libro_iva":{"periodo":"2025-11","total":25000000.11,"neto":22624434.48,"iva":2375565.60,"estado":"coincide (centavos de redondeo del libro)"}}'),

-- V6 · Sáenz Valiente 209-32006 · cuenta de venta · FAENA 8 cab. (vacas y toros) · 2 plazos
('92ebb1f3-bf43-4202-aceb-9e59274f27e4','2026-01-27',60,209,32006,'209-32006',null,
 '30576703119','SAENZ VALIENTE BULLRICH Y CIA SA',2026,1,'DDJJ OK','PES','pesos',
 12647000.00,537497.50,12109502.50,0,0,10.50,1271497.77, 13381000.27,0,94852.50,'VENTA DESCARTE (cut, vacia, toro)','410802','Cria','conciliado','ganaderia',
 null,null,4410,null,null,8,
 '[{"cuit":"33653239829","kilos":1610,"precio":3100,"cabezas":3,"razonSocial":"FRIMSA S.A.","clasificacion":"Vaca CUT/Descarte"},{"cuit":"33653239829","kilos":480,"precio":2800,"cabezas":1,"razonSocial":"FRIMSA S.A.","clasificacion":"Vaca CUT/Descarte"},{"cuit":"33653249549","kilos":1510,"precio":3000,"cabezas":2,"razonSocial":"RUNFO S.A.","clasificacion":"Toro"},{"cuit":"30687827518","kilos":810,"precio":2200,"cabezas":2,"razonSocial":"VERDE Y NEGRO SRL","clasificacion":"Vaca CUT/Descarte"}]',
 '[{"pct":50,"dias":1,"estado":"cobrado","importe":6526036.96,"vencimiento":"2026-01-28"},{"pct":50,"dias":40,"estado":"cobrado","importe":6524297.81,"vencimiento":"2026-03-08"}]',
 'Faena — MAG Cañuelas. Gastos: comisión 3,5 % $442.645 + derecho de piso 0,75 % $94.852,50. Ret. RG 830 $235.813 e IIBB $94.852,50 impresas. Neto $13.050.334,77 [script 111]',
 '{"version":1,"origen":"script 111 — leído por Claude del PDF","archivo":"01-27 - Saenz Valiente Liq .pdf","drive_id":"1_0iaKOpZhAowGiD8rUxrQTJ4BzOyFdYL","libro_iva":{"periodo":"2026-01","total":13050334.77,"neto":12109502.50,"iva":1271497.80,"estado":"coincide (el libro informa el total neto de retenciones)"}}'),

-- V7 · Sáenz Valiente 209-32007 · cuenta de venta · INVERNADA 5 vaquillonas · 2 plazos
('5ca8b345-2e5f-4ac9-96ac-29bf5290c41e','2026-01-27',60,209,32007,'209-32007',null,
 '30576703119','SAENZ VALIENTE BULLRICH Y CIA SA',2026,1,'DDJJ OK','PES','pesos',
 10212000.00,434010.00,9777990.00,0,0,10.50,1026688.95, 10804678.95,0,76590.00,'VENTA INVERNADA MACHO Y HEMBRA','410805','Recria','conciliado','ganaderia',
 null,null,2760,null,null,5,
 '[{"cuit":"30707916075","kilos":2760,"precio":3700,"cabezas":5,"razonSocial":"SANTA GIULIA S.A.","clasificacion":"Vaquillona"}]',
 '[{"pct":50,"dias":1,"estado":"cobrado","importe":5267927.60,"vencimiento":"2026-01-28"},{"pct":50,"dias":40,"estado":"cobrado","importe":5266133.35,"vencimiento":"2026-03-08"}]',
 'Invernada — MAG Cañuelas. Gastos: comisión 3,5 % $357.420 + derecho de piso 0,75 % $76.590. Ret. RG 830 $194.028 e IIBB $76.590 impresas. Neto $10.534.060,95 [script 111]',
 '{"version":1,"origen":"script 111 — leído por Claude del PDF","archivo":"01-27 - Saenz Valiente Liq.pdf","drive_id":"1aVXvmV0s99W6OzNpoQ-gy-IAm7gegzgU","libro_iva":{"periodo":"2026-01","total":10534060.95,"neto":9777990.00,"iva":1026689.00,"estado":"coincide (el libro informa el total neto de retenciones)"}}'),

-- V8 · Genta 11-77393 · AJUSTE de la liquidación 11-75880: comisión $252.646,58 + IVA · negativo · «es gasto» (JMS)
('f8fb8fc7-f0ef-4295-9733-2b121a30079a','2026-02-26',60,11,77393,'11-77393',null,
 '30526554562','PEDRO GENTA Y COMPAÑIA SOCIEDAD ANONIMA',2026,2,'DDJJ OK','PES','pesos',
 0,0,-252646.58,0,0,10.50,-26527.89, -279174.47,0,0,'COMISIONES','421309','Recria','cobrado','ganaderia',
 null,null,null,null,null,null,null,null,
 'Ajuste financiero de crédito de la 11-75880 (venta 70 terneros del 27/01): comisión $252.646,58 + IVA $26.527,89. JMS: «es gasto» [script 111]',
 '{"version":1,"origen":"script 111 — leído por Claude del PDF","archivo":"02-26 - liquidacion de ajuste - es gasto - ver que no este presentado antes.pdf","drive_id":"1SGxajhcvdGT8NPDySNI75cCdLp80SPQL","ajusta":"11-75880","libro_iva":{"periodo":"2026-02","total":-279174.47,"estado":"coincide"}}'),

-- V9 · Ballester liquidación de venta directa 10-12 (cód. 190) · 4 vacas de invernada a $594.000 por cabeza
('f3c0bbad-0f3f-4f76-8a16-8c023449deab','2026-04-28',190,10,12,'00010-00000012',null,
 '20249560791','BALLESTER PAULO CESAR',2026,4,'DDJJ OK','PES','pesos',
 2376000.00,0,2376000.00,0,0,10.50,249480.00, 2625480.00,0,0,'VENTA DESCARTE (cut, vacia, toro)','410802','Cria','conciliado','ganaderia',
 null,null,null,594000,null,4,
 '[{"cuit":"20249560791","kilos":null,"precio":594000,"cabezas":4,"razonSocial":"BALLESTER PAULO CESAR","clasificacion":"Vaca (invernada, Aberdeen Angus) — precio por cabeza"}]',
 null,
 'Liquidación de venta directa — 4 vacas de invernada Aberdeen Angus a $594.000 por cabeza [script 111]',
 '{"version":1,"origen":"script 111 — leído por Claude del PDF","archivo":"04-28 - Venta 4 Vacas - Ballester Pablo Cesar.pdf","drive_id":"168wGHuG6xuMZ6FaEi-9P-dEj_xxA7elj","libro_iva":{"periodo":"2026-04","total":2625480.00,"estado":"coincide"}}');

-- ── 2 · Retenciones que no van impresas en el comprobante ───────────────────────────
-- Las de las facturas de arrendamiento se CALCULARON: cierran al centavo con el cobro del banco.
-- Falta el certificado de cada una (lo trae la orden de pago del cliente).
insert into msa.retenciones_recibidas (tipo, monto, cuenta_contable, comprobante_venta_id, cuit_cliente, denominacion_cliente, fecha, observaciones) values
('ganancias', 3420985.60, 'RETENCIONES DE GANANCIAS', 'a7dfdce5-5d26-4070-bde1-e82d5b8678ca', '30712200622', 'Sanpa Semillas SA', '2025-07-10',
 '[script 111] 6 % sobre ($57.027.626,70 − $11.200). Calculada: con la de IIBB cierra al centavo con el cobro del 10/07 ($53.036.364,83). Falta el certificado.'),
('iibb',       570276.27, 'RETENCIONES IIBB',         'a7dfdce5-5d26-4070-bde1-e82d5b8678ca', '30712200622', 'Sanpa Semillas SA', '2025-07-10',
 '[script 111] 1 % sobre $57.027.626,70. Calculada: cierra al centavo con el cobro del 10/07. Falta el certificado.'),
('ganancias', 3990103.10, 'RETENCIONES DE GANANCIAS', '5375d919-1a49-44c0-8026-f2756ececb62', '30712200622', 'Sanpa Semillas SA', '2025-11-12',
 '[script 111] 6 % sobre ($66.512.918,34 − $11.200), sin IIBB. Calculada: cierra al centavo con los cobros del 10/11 ($20.000.000) y 12/11 ($42.522.815,24). Falta el certificado.'),
('ganancias', 2773406.22, 'RETENCIONES DE GANANCIAS', '4cac5636-949d-4843-8889-58ae53400f3c', '33710346939', 'PROVINVEST S.A.', '2025-11-20',
 '[script 111] 6 % sobre ($46.290.636,93 − $67.200). Calculada: cierra al centavo con el cobro del 20/11 ($43.517.230,71). Falta el certificado (orden de pago Provinvest).'),
('ganancias',  235813.00, 'RETENCIONES DE GANANCIAS', '92ebb1f3-bf43-4202-aceb-9e59274f27e4', '30576703119', 'SAENZ VALIENTE BULLRICH Y CIA SA', '2026-01-27',
 '[script 111] RG 830 2 % impresa en la cuenta de venta 209-32006.'),
('ganancias',  194028.00, 'RETENCIONES DE GANANCIAS', '5ca8b345-2e5f-4ac9-96ac-29bf5290c41e', '30576703119', 'SAENZ VALIENTE BULLRICH Y CIA SA', '2026-01-27',
 '[script 111] RG 830 2 % impresa en la cuenta de venta 209-32007.');

-- ── 3 · El cobro atado al banco (sólo columnas de conciliación; el detalle de JMS no se toca) ──
update public.msa_galicia set comprobante_venta_id = 'a7dfdce5-5d26-4070-bde1-e82d5b8678ca', categ = 'ARRENDAMIENTOS Venta', nro_cuenta = '4109',
  estado = 'conciliado', comprobantes_pagados = '00010-00000017'
where id = 'bee70a64-0097-45e4-919f-359969f54aad' and comprobante_venta_id is null and estado = 'historico';

update public.msa_galicia set comprobante_venta_id = '5375d919-1a49-44c0-8026-f2756ececb62', categ = 'ARRENDAMIENTOS Venta', nro_cuenta = '4109',
  estado = 'conciliado', comprobantes_pagados = '00010-00000018'
where id in ('c44dccf0-261f-443a-b760-eb2e3f93e5e1','7839b5a1-947b-4514-87cd-8dc7156401cc') and comprobante_venta_id is null and estado = 'historico';

update public.msa_galicia set comprobante_venta_id = '4cac5636-949d-4843-8889-58ae53400f3c', categ = 'ARRENDAMIENTOS Venta', nro_cuenta = '4109',
  estado = 'conciliado', comprobantes_pagados = '00010-00000008'
where id = '6aa2761f-f86e-44de-aeb8-739b5440c503' and comprobante_venta_id is null and estado = 'historico';

-- Sáenz Valiente: cada movimiento paga UNA CUOTA DE CADA liquidación (6.526.036,96 + 5.267.927,60 el 28-29/01;
-- 6.524.297,81 + 5.266.133,35 el 09/03). El vínculo admite un solo comprobante: se ata a la 32006 y las dos
-- quedan nombradas en «comprobantes pagados».
update public.msa_galicia set comprobante_venta_id = '92ebb1f3-bf43-4202-aceb-9e59274f27e4', categ = 'VENTA DESCARTE (cut, vacia, toro)', nro_cuenta = '410802',
  estado = 'conciliado', comprobantes_pagados = '209-32006 cuota 1/2 + 209-32007 cuota 1/2'
where id in ('2ebe6ce0-1378-4539-9867-0d6c96a39d8c','4a329ea1-1f0a-4c2c-b8c2-6f327750bd9b') and comprobante_venta_id is null and estado = 'historico';

update public.msa_galicia set comprobante_venta_id = '92ebb1f3-bf43-4202-aceb-9e59274f27e4', categ = 'VENTA DESCARTE (cut, vacia, toro)', nro_cuenta = '410802',
  estado = 'conciliado', comprobantes_pagados = '209-32006 cuota 2/2 + 209-32007 cuota 2/2'
where id = 'c358fc1e-9eb3-44ac-aa5c-4073ed2337a2' and comprobante_venta_id is null and estado = 'pendiente';

-- Ballester: ya estaba conciliado por JMS como «ANTICIPO COBRO»; sólo se agrega el vínculo a la venta.
update public.msa_galicia set comprobante_venta_id = 'f3c0bbad-0f3f-4f76-8a16-8c023449deab'
where id = '1058a6e0-c2f5-4d6f-aab3-f4f4f9c64d94' and comprobante_venta_id is null;

-- ── 4 · Control: tiene que dar 9 ventas, 6 retenciones y 8 movimientos atados ──────
do $$
declare v int; r int; m int;
begin
  select count(*) into v from msa.comprobantes_venta where datos_adicionales like '%[script 111]%';
  select count(*) into r from msa.retenciones_recibidas where observaciones like '[script 111]%';
  select count(*) into m from public.msa_galicia where comprobante_venta_id in (
    'a7dfdce5-5d26-4070-bde1-e82d5b8678ca','5375d919-1a49-44c0-8026-f2756ececb62','4cac5636-949d-4843-8889-58ae53400f3c',
    '92ebb1f3-bf43-4202-aceb-9e59274f27e4','f3c0bbad-0f3f-4f76-8a16-8c023449deab');
  if v <> 9 or r <> 6 or m <> 8 then
    raise exception 'script 111: no cierra — ventas %, retenciones %, movimientos % (esperado 9 / 6 / 8)', v, r, m;
  end if;
end $$;

commit;
