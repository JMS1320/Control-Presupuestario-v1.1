-- [script 318] DATOS (con OK de JMS 27/11) — los concentrados de Biofarma con su fecha REAL de llegada y la medición del corte (A-FEAT-1663).
-- JMS 27/11: «el 2/9 llegaron los 4.500 kg (2 concentrados distintos), el 21/9 llegaron los 4.500 kg de cc novillo» · «la medición al 23/9 es de
-- 450 kilos, son las 18 bolsas, más los 4.500 kilos… o sea que la medición es 4.950. Es la única manera de que cierre» · «los 3.000 kilos del
-- concentrado ternero estaban intactos al 23/9 y están intactos hoy, porque no se empezó a dar creep feeding».
-- Antes de correr (verificado 27/11): las facturas 0104-00005696 y 0067-00008263 sin vínculo; stock Novillo 3.000 kg, Terneros 0 (costo 0 los dos);
-- medición del Novillo 23/09 = 450 (id 2cad97bd…); Terneros sin mediciones.
-- Precio = neto del renglón / kg (lo que dice la factura): Novillo $ 769,035/kg · Terneros $ 1.519,65/kg.
-- Deshacer: scripts/318-concentrados-biofarma-y-mediciones-deshacer.sql
begin;
with nuevas as (
  insert into productivo.movimientos_insumos (fecha, insumo_stock_id, tipo, cantidad, costo_unitario, monto_total, proveedor, cuit, empresa, moneda, observaciones) values
   ('2026-09-02', 'bf021076-bd4c-42ee-a61c-ddcd0823e947', 'compra', 1500, 769.035, 1153552.50, 'BIOFARMA S A', '30571438247', 'MSA', 'ARS', '[script 318] llegó el 02/09 (JMS) · factura 0104-00005696 renglón 1'),
   ('2026-09-02', 'a167aae2-687b-48a2-a673-f58cee565295', 'compra', 3000, 1519.65, 4558950.00, 'BIOFARMA S A', '30571438247', 'MSA', 'ARS', '[script 318] llegó el 02/09 (JMS) · factura 0104-00005696 renglón 2'),
   ('2026-09-21', 'bf021076-bd4c-42ee-a61c-ddcd0823e947', 'compra', 4500, 769.035, 3460657.50, 'BIOFARMA S A', '30571438247', 'MSA', 'ARS', '[script 318] llegó el 21/09 (JMS) · factura 0067-00008263 renglón 1')
  returning id, fecha, insumo_stock_id, cantidad, costo_unitario, observaciones
)
insert into productivo.entrega_factura (movimiento_id, factura_id, empresa, origen, cantidad, precio_unitario, notas, renglon_n, automatico, antes)
select id, case when fecha = '2026-09-21' then 'fa0c6f67-0d91-4304-bb06-0ae2a017ed70'::uuid else '7de39425-76e6-42e4-b77a-97cbb2bf3907'::uuid end, 'MSA', 'arca',
       cantidad, costo_unitario, '[script 318] entrada cargada con la factura (fecha de llegada dicha por JMS)',
       case when insumo_stock_id = 'a167aae2-687b-48a2-a673-f58cee565295' then 2 else 1 end, false, '{"creado": true}'::jsonb
  from nuevas;
-- el stock sube lo que entró, y el costo (vacío) toma el de la factura
update productivo.stock_insumos set cantidad = cantidad + 6000, costo_unitario = 769.035 where id = 'bf021076-bd4c-42ee-a61c-ddcd0823e947' and cantidad = 3000;
update productivo.stock_insumos set cantidad = cantidad + 3000, costo_unitario = 1519.65 where id = 'a167aae2-687b-48a2-a673-f58cee565295' and cantidad = 0;
-- lo aprendido: cada renglón de las dos facturas es ese insumo
update public.factura_renglones set insumo_stock_id = 'bf021076-bd4c-42ee-a61c-ddcd0823e947' where empresa = 'MSA' and n = 1 and comprobante_id in ('7de39425-76e6-42e4-b77a-97cbb2bf3907','fa0c6f67-0d91-4304-bb06-0ae2a017ed70') and insumo_stock_id is null;
update public.factura_renglones set insumo_stock_id = 'a167aae2-687b-48a2-a673-f58cee565295' where empresa = 'MSA' and n = 2 and comprobante_id = '7de39425-76e6-42e4-b77a-97cbb2bf3907' and insumo_stock_id is null;
-- la medición del corte: 18 bolsas (450) + los 4.500 del 21/09 sin abrir = 4.950 (queda la huella de lo que decía)
update productivo.mediciones_insumo set cantidad = 4950,
  notas = notas || ' · [script 318] JMS 27/11: eran 450 (18 bolsas) + los 4.500 kg llegados el 21/09 sin abrir = 4.950 (antes decía 450)'
 where id = '2cad97bd-a498-48e6-993f-6d3e055505e5' and cantidad = 450;
-- Concentrado Terneros: intacto al corte y hoy (no se empezó el creep)
insert into productivo.mediciones_insumo (insumo_stock_id, fecha, cantidad, notas) values
 ('a167aae2-687b-48a2-a673-f58cee565295', '2026-09-23', 3000, '[script 318] intacto al 23/09 (JMS 27/11)'),
 ('a167aae2-687b-48a2-a673-f58cee565295', '2026-11-27', 3000, '[script 318] intacto hoy: no se empezó a dar creep feeding (JMS 27/11)');
commit;
