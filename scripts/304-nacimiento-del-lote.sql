-- 304 · A-FEAT-1663 — el NACIMIENTO del lote (fecha y peso) para que la curva del ternero al pie salga del lote (ESTRUCTURA + DATOS, OK de JMS 25/11)
-- JMS: «si ya está puesto con 220 dejalo con 220 y que el cálculo de kg se base en lo ya puesto por mí… si quiero cambiar los kg lo
-- cambio para el lote y eso afecte al gasto, que esté vinculado. Pero el peso promedio es el promedio entre el nacimiento y el destete».
-- La ganancia diaria NO se guarda: sale de (peso del lote − peso al nacer) / días entre el nacimiento y la pesada del lote.
-- Deshacer: 304-…-deshacer.sql (las columnas no existían; el tramo vuelve a la ganancia que le puso el 303 — o sea, se deshace también eso).
alter table productivo.stock_lotes add column if not exists fecha_nacimiento date;
alter table productivo.stock_lotes add column if not exists peso_nacimiento_kg numeric;
comment on column productivo.stock_lotes.fecha_nacimiento is '[script 304] Cuándo nacieron (lotes de cría). Con el peso al nacer y el del lote se arma la curva del ternero al pie.';
comment on column productivo.stock_lotes.peso_nacimiento_kg is '[script 304] Peso al nacer (kg).';
update productivo.stock_lotes set fecha_nacimiento = '2026-07-01', peso_nacimiento_kg = 30 where id = '9464e9d7-6ff7-49d5-bdba-bc7306b3a527';
-- La ganancia fija del 303 sale: ahora la da el lote (220 kg el 01/03/27 → 0,78 kg/día).
update productivo.lote_tramos set ganancia_diaria_kg = null, notas = '[script 304] la ganancia sale del lote: nacimiento 30 kg el 1/7 → peso del lote', updated_at = now()
where id = '1dea1b5d-a402-4216-8734-270e994f7d27';
