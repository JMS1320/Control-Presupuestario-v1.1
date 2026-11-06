-- Deshace 212 · borra SÓLO las filas que puso el 212 (marca en creado_por). Los archivos del Drive no se tocan.
delete from public.documentos_respaldo where creado_por like '[script 212]%';
