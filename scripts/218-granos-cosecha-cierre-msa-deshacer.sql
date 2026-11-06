-- Deshace 218: borra sólo las dos filas que puso (marca '[script 218]') y sólo si nadie las editó después.
delete from public.balance_datos_usuario
where empresa='MSA' and anio_cierre=2026 and papel='granos' and clave in ('cosecha','cierre') and actualizado_por like '[script 218]%' and historial = '[]'::jsonb;
