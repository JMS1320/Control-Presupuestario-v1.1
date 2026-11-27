-- [script 316] DATOS (con OK de JMS 27/11: «solo procesá lo del silo ok») — el SILO DE SORGO (A-FEAT-1663).
-- JMS 27/11: «a esa fecha [23/09] había 33 metros de silo × 3.550 kg por metro = 117.150 kg. Ese mismo stock existía al 30/6/26
-- (registrarlo en stock de balance). La diferencia de stock de inicio a cierre de balance al 30/6 es lo que consumió la vaca en el
-- ejercicio: imputárselo a Cría… a 27/10, una vez dada la ración, quedaban 22 metros = 78.100 kg (control del feed lot, con pinzas)»
-- · «respecto del silo mantener su valor en US$».
-- Antes de correr (verificado 27/11): el silo no tenía mediciones ni consumo declarado; stock_insumos.cantidad = 0, unidad 't';
-- stock_inicio sólo tenía la fila del 30/06/2025 (279,385 t, script 132); el renglón de silo de Engorde sin insumo del stock.
-- Deshacer: scripts/316-silo-de-sorgo-deshacer.sql (borra lo marcado «[script 316]» y vuelve la unidad y el renglón).
begin;
-- 1) La unidad del silo pasa a kg (la receta va en kg/cab/día; la cantidad es 0, no cambia nada más).
update productivo.stock_insumos set unidad_medida = 'kg' where id = '8289c48d-be7e-4933-b4a5-5149141ea1d8' and unidad_medida = 't';
-- 2) Las mediciones (niveles), con su fuente.
insert into productivo.mediciones_insumo (insumo_stock_id, fecha, cantidad, notas) values
 ('8289c48d-be7e-4933-b4a5-5149141ea1d8', '2025-06-30', 279385, '[script 316] stock al cierre 24/25: 279,385 t (papel enviado al contador, hoja «5 - FORRAJEROS 6 - GAS OIL», fila 6)'),
 ('8289c48d-be7e-4933-b4a5-5149141ea1d8', '2026-06-30', 117150, '[script 316] stock al cierre 25/26: 33 m × 3.550 kg/m (JMS 27/11: el mismo que al 23/09)'),
 ('8289c48d-be7e-4933-b4a5-5149141ea1d8', '2026-09-23', 117150, '[script 316] último día de recría (JMS 27/11: el 24/09 fue el primer día de ración del feed lot): 33 m × 3.550 kg/m'),
 ('8289c48d-be7e-4933-b4a5-5149141ea1d8', '2026-10-27', 78100,  '[script 316] control del feed lot, ya dada la ración: 22 m × 3.550 kg/m (JMS: por metro, tomarlo con pinzas)');
-- 3) Lo que comieron las vacas en el ejercicio 25/26 (279.385 − 117.150), entero a Cría. Fecha 29/06: dentro del tramo entre las dos mediciones.
insert into productivo.consumo_declarado_insumo (insumo_stock_id, centro_costo_id, fecha, cantidad, notas) values
 ('8289c48d-be7e-4933-b4a5-5149141ea1d8', 'dccc9ad5-2bda-41a2-bb45-40c39256ac38', '2026-06-29', 162235,
  '[script 316] consumo de las vacas en el ejercicio 25/26 = stock 30/06/2025 (279.385 kg) − stock 30/06/2026 (117.150 kg) (JMS 27/11)');
-- 4) El stock del balance al 30/06/2026 (interno), en US$: 117,15 t × US$ 48 = US$ 5.623,20 × TC 1.473 (BNA divisas comprador 30/06/26).
insert into productivo.stock_inicio (empresa, fecha, version, insumo_stock_id, rubro, producto_planilla, categoria_planilla, cantidad, unidad, precio_unitario, moneda, tipo_cambio, valor_pesos, emparejado, fuente, nota)
values ('MSA', '2026-06-30', 'jms', '8289c48d-be7e-4933-b4a5-5149141ea1d8', 'forraje', 'Silo de sorgo', 'Forraje', 117.15, 't', 48, 'USD', 1473, 8282973.60, 'mismo',
  '[script 316] JMS 27/11: 33 m × 3.550 kg/m = 117.150 kg (el mismo stock que al 23/09/26)', 'valor en US$ como en el cierre 24/25 (US$ 48/t); TC BNA divisas comprador 30/06/2026');
-- 5) El renglón de silo de la receta de Engorde come el silo del stock (el presupuesto netea el stock y dice cuándo se termina).
update productivo.actividad_insumos set insumo_stock_id = '8289c48d-be7e-4933-b4a5-5149141ea1d8'
 where id = 'ee02f97e-ec04-40d6-be8d-ff58f633f71b' and insumo_stock_id is null;
commit;
