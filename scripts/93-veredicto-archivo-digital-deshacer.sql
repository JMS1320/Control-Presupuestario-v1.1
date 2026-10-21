-- Deshace el script 93 (veredicto del archivo digital). Pierde los veredictos cargados.
alter table public.arca_pdf_archivo_digital drop constraint if exists arca_pdf_archivo_digital_veredicto_chk;
alter table public.arca_pdf_archivo_digital
  drop column if exists veredicto,
  drop column if exists veredicto_nota,
  drop column if exists veredicto_at,
  drop column if exists veredicto_por;
notify pgrst, 'reload schema';
