-- Deshace 221 · borra SÓLO las filas que puso el 221. Los archivos del Drive no se tocan.
delete from public.documentos_respaldo where creado_por like '[script 221]%';
