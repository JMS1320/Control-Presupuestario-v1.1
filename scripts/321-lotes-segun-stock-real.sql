-- [script 321] DATOS (con OK de JMS 27/11: «podés corregir los lotes también») — A-FEAT-1672 paso 4: los lotes de venta del presupuesto
-- coinciden con el stock real de hacienda (movimientos de T-caravanas del 24/09, 30/09 y 01/10).
--  · Ternero Recría 40 → **Novillo 39** (entraron al feed lot como novillos el 24/09; 1 era hembra: corrección de sexo del 30/09)
--  · Ternera Recría 12 → **Vaquillona Engorde 9**
--  · Ternera Recría 69 → **0** (son las 74 vaquillonas de reposición inseminadas el 01/10: ya están en el rodeo del ciclo 26/27, no se venden)
--  · Torito 9 → **8**
-- Los lotes conservan sus tramos, las 3 raciones del feed lot, el plan del año, el peso y el precio por kg cargados. Lo anterior queda en `notas`.
-- Antes de correr (verificado 27/11): los 4 lotes con esos valores. Deshacer: scripts/321-lotes-segun-stock-real-deshacer.sql (por id).
begin;
update productivo.stock_lotes set categoria = 'Novillo', cantidad = 39, notas = coalesce(notas, '') || ' · [script 321] antes Ternero Recria 40 → Novillo 39 (stock real 27/11)', updated_at = now()
 where id = '84a7cb3e-7783-46ef-aa1e-c8a3223d6c3b' and categoria = 'Ternero Recria' and cantidad = 40;
update productivo.stock_lotes set categoria = 'Vaquillona Engorde', cantidad = 9, notas = coalesce(notas, '') || ' · [script 321] antes Ternera Recria 12 → Vaquillona Engorde 9 (stock real 27/11)', updated_at = now()
 where id = '1faa6f50-5c46-48b5-a83e-1db9cd6d5223' and categoria = 'Ternera Recria' and cantidad = 12;
update productivo.stock_lotes set cantidad = 0, notas = coalesce(notas, '') || ' · [script 321] antes 69 → 0: son las 74 vaquillonas de reposición del rodeo (01/10/26), no se venden', updated_at = now()
 where id = '58195607-0d4c-4937-b50c-2c9905a3100a' and cantidad = 69;
update productivo.stock_lotes set cantidad = 8, notas = coalesce(notas, '') || ' · [script 321] antes 9 → 8 (stock real 27/11)', updated_at = now()
 where id = 'a04ffb39-0399-497d-9c48-a7cb85c3f0aa' and cantidad = 9;
-- Y las 3 raciones del feed lot (script 320) se habían repartido por cabeza sobre 52 (los lotes viejos); el corral real tenía 48 (39 + 9):
-- por cabeza = kg del día ÷ 48, así el total del día sigue siendo el que anotó JMS (910 / 275 / 65…).
update public.presupuesto_variables set cantidad = round(cantidad * 52.0 / 48.0, 6),
  fundamento = fundamento || ' · [script 321] por cabeza sobre 48 (antes ÷ 52)'
 where fundamento like '[script 320]%' and fundamento not like '%[script 321]%';
commit;
