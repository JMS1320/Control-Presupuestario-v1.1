-- 94 · HUELLA de la carga de una factura desde su PDF (A-FEAT-1318, usuario 2026-10-23)
--
-- «Seguí con cargar la factura desde el PDF.» Un PDF sin vincular que no está en ARCA se carga como
-- factura No Informada con lo que la app leyó del PDF; el usuario corrige y graba. La regla del
-- importador (CLAUDE.md § 📄, punto 4) pide guardar lo LEÍDO al lado de lo CARGADO, para saber qué
-- campo falla más y en qué proveedor.
--
-- Seis columnas en el registro del archivo digital (script 92), el lugar natural: es la fila del PDF.
--   comprobante_id      → la factura que se cargó desde este PDF
--   comprobante_empresa → su empresa (MSA / PAM / MA: la factura vive en el schema de la empresa)
--   carga_leido         → lo que leyó la app, en la forma de la pantalla de carga
--   carga_correcciones  → sólo lo que el usuario cambió: [{campo, leido, cargado}]
--   cargado_at / cargado_por
--
-- Sin este script la carga funciona igual: la huella queda en texto en la factura (pdf_observaciones)
-- y la app avisa que el registro no la guardó.
--
-- Aditivo: no toca ninguna fila existente. Deshacer: 94-carga-desde-pdf-archivo-digital-deshacer.sql

alter table public.arca_pdf_archivo_digital
  add column if not exists comprobante_id      uuid,
  add column if not exists comprobante_empresa text,
  add column if not exists carga_leido         jsonb,
  add column if not exists carga_correcciones  jsonb,
  add column if not exists cargado_at          timestamptz,
  add column if not exists cargado_por         text;

notify pgrst, 'reload schema';
