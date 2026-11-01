-- Deshace 174: borra sólo las dos filas que puso, y sólo si nadie las editó.
delete from public.balance_datos_usuario where empresa='MSA' and anio_cierre=2026 and papel='fci'
  and clave in ('cuotapartes_inicio','valor_cuotaparte_inicio') and actualizado_por like '[script 174]%' and historial = '[]'::jsonb;
