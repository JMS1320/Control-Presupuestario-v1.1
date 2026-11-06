-- Deshace 214 · borra SÓLO las filas que puso el 214. Los archivos del Drive no se tocan.
delete from public.documentos_respaldo where creado_por like '[script 214]%';
