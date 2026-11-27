-- Deshace el [script 321] (valores anteriores verificados 27/11).
begin;
update productivo.stock_lotes set categoria = 'Ternero Recria', cantidad = 40, notas = split_part(notas, ' · [script 321]', 1) where id = '84a7cb3e-7783-46ef-aa1e-c8a3223d6c3b';
update productivo.stock_lotes set categoria = 'Ternera Recria', cantidad = 12, notas = split_part(notas, ' · [script 321]', 1) where id = '1faa6f50-5c46-48b5-a83e-1db9cd6d5223';
update productivo.stock_lotes set cantidad = 69, notas = split_part(notas, ' · [script 321]', 1) where id = '58195607-0d4c-4937-b50c-2c9905a3100a';
update productivo.stock_lotes set cantidad = 9, notas = split_part(notas, ' · [script 321]', 1) where id = 'a04ffb39-0399-497d-9c48-a7cb85c3f0aa';
update public.presupuesto_variables set cantidad = round(cantidad * 48.0 / 52.0, 6), fundamento = split_part(fundamento, ' · [script 321]', 1) where fundamento like '%[script 321]%';
commit;
