-- Deshace 170: borra sólo las dos filas que puso (marca '[script 170]') y sólo si nadie las editó después.
delete from public.balance_datos_usuario
where empresa='MSA' and anio_cierre=2026 and papel='fci' and actualizado_por like '[script 170]%' and historial = '[]'::jsonb;
