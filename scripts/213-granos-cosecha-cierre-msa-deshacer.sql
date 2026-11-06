-- Deshace 213: borra sólo las dos filas que puso (marca '[script 213]') y sólo si nadie las editó después.
delete from public.balance_datos_usuario
where empresa='MSA' and anio_cierre=2026 and papel='granos' and clave in ('cosecha','cierre') and actualizado_por like '[script 213]%' and historial = '[]'::jsonb;
