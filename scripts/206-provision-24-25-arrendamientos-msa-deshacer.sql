-- Deshace el script 206: borra SÓLO las filas que creó (marca «[script 206]» en creado_por).
delete from public.ajustes_balance where creado_por = '[script 206]';
