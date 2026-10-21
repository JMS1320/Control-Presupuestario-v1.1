-- Deshace 92 · borra el registro del archivo digital.
-- ⚠️ Se pierde lo leído de las carpetas: la próxima búsqueda vuelve a leer los archivos sin vincular. No toca facturas ni Drive.
drop table if exists public.arca_pdf_archivo_digital;
