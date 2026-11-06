-- Deshace 219 · borra SÓLO las filas que puso el 219. Los archivos del Drive no se tocan.
delete from public.documentos_respaldo where creado_por like '[script 219]%';
