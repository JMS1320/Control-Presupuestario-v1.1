-- Deshace 204: borra sólo las filas que puso, y sólo si nadie las editó.
delete from public.balance_datos_usuario where empresa='MSA' and anio_cierre=2026 and papel='hacienda.saldos'
  and clave like 'cierre.senasa.%' and actualizado_por like '[script 204]%' and historial = '[]'::jsonb;
