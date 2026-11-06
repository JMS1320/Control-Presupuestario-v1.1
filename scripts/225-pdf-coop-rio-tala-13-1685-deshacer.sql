-- Deshace 225 · vuelve la factura a como estaba (sin PDF, «no_encontrado»).
update msa.comprobantes_arca
   set pdf_drive_url = null, pdf_estado = 'no_encontrado',
       pdf_observaciones = 'No se encontró adjunto que coincida. Búsqueda Gmail: 0 threads / 0 adjuntos analizados. ⚠️ Proveedor sin mail propio: solo se buscó por reenvíos. Cargá su mail en "Config PDFs" para búsqueda directa.'
 where id = '62cd1649-843c-4a38-aa9f-7e246842d1ce' and pdf_observaciones like '%[script 225]%';
