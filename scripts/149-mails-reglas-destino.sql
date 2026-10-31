-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🗂️ Script 149 — A-FEAT-1442 etapa 2: cada REGLA de mails sabe a qué carpeta del archivo digital van sus documentos
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-31: «también desde la vista de mails, para trabajar de a lotes ahí».
--
-- `public.mails_reglas.archivo_destino` → `public.archivo_destinos.clave` (FK, on update cascade, on delete set null).
-- Vacío = la regla todavía no sabe dónde guardar: en la pantalla de lotes, su grupo muestra el 📁❗ rojo.
-- Se elige ahí mismo (CLAUDE.md § 🧩): un destino existente o «＋ nuevo destino».
--
-- Escribe: 1 columna nueva vacía + su FK. FRENA si la columna ya existe. No toca datos ni RLS.
-- Deshacer: 149-mails-reglas-destino-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mails_reglas' and column_name = 'archivo_destino') then
    raise exception 'mails_reglas.archivo_destino YA EXISTE: no se corre nada.';
  end if;
end $$;
alter table public.mails_reglas add column archivo_destino text
  constraint mails_reglas_archivo_destino_fk references public.archivo_destinos(clave) on update cascade on delete set null;
comment on column public.mails_reglas.archivo_destino is '[script 149] A-FEAT-1442 — a qué carpeta del archivo digital van los adjuntos de los mails de esta regla (vacío = 📁❗).';
commit;
notify pgrst, 'reload schema';

-- Control (sólo lee): la columna existe y está vacía
select count(*) as reglas, count(archivo_destino) as con_destino from public.mails_reglas;
