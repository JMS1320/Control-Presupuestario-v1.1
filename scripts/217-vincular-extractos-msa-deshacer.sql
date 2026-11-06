-- Deshace 217 · borra SÓLO las filas que puso el 217 (marca en creado_por). Los archivos del Drive no se tocan.
delete from public.documentos_respaldo where creado_por like '[script 217]%';
