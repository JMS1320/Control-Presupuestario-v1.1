-- Deshace el script 94 (huella de la carga desde el PDF). Pierde la huella estructurada; la de texto
-- en cada factura (pdf_observaciones) queda.
alter table public.arca_pdf_archivo_digital
  drop column if exists comprobante_id,
  drop column if exists comprobante_empresa,
  drop column if exists carga_leido,
  drop column if exists carga_correcciones,
  drop column if exists cargado_at,
  drop column if exists cargado_por;
notify pgrst, 'reload schema';
