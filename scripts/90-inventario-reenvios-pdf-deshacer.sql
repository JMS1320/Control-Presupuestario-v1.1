-- Deshace 90 · borra el inventario de adjuntos de los reenvíos y los tramos leídos.
-- ⚠️ Se pierde lo leído: la próxima búsqueda vuelve a leer los reenvíos desde cero. No toca facturas ni el log.
drop table if exists public.arca_pdf_barrido_tramo;
drop table if exists public.arca_pdf_inventario;
