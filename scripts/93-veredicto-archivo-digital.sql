-- 93 · VEREDICTO de los PDF sin vincular del archivo digital (A-FEAT-1287 / A-FEAT-1318, usuario 2026-10-22)
--
-- «Ahí sería bueno esa factura que quede que está en la carpeta y no vinculada… en principio darle un
-- veredicto a mano por ahora. Todo esto lo gestiono desde audit subdiarios.»
--
-- Cuatro columnas nuevas en el registro del archivo digital (script 92). Un PDF que la app todavía no
-- leyó (salió de «Contar») se registra al darle el veredicto con estado 'sin_leer'.
--
--   veredicto: 'no_informada'  → no informada en ARCA (va a «Asientos Contables» una vez cargada)
--              'otra_carpeta'  → va en otra carpeta (la nota dice cuál)
--              'no_es_factura' → no es una factura (remito, resumen, etc.)
--              'duplicado'     → es una copia de otro archivo
--              'pendiente'     → visto, sin resolver todavía
--   NULL = sin veredicto.
--
-- Aditivo: no toca ninguna fila existente. Deshacer: 93-veredicto-archivo-digital-deshacer.sql

alter table public.arca_pdf_archivo_digital
  add column if not exists veredicto      text,
  add column if not exists veredicto_nota text,
  add column if not exists veredicto_at   timestamptz,
  add column if not exists veredicto_por  text;

alter table public.arca_pdf_archivo_digital
  drop constraint if exists arca_pdf_archivo_digital_veredicto_chk;
alter table public.arca_pdf_archivo_digital
  add constraint arca_pdf_archivo_digital_veredicto_chk
  check (veredicto is null or veredicto in ('no_informada', 'otra_carpeta', 'no_es_factura', 'duplicado', 'pendiente'));

notify pgrst, 'reload schema';
