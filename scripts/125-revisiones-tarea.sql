-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🚩 Script 125 — A-FEAT-1411: una 🚩 puede ser una TAREA para la persona, con fecha
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-28: «los flags le llegan a su Principal… un flag es algo urgente… la flag incluye la creación de una
-- tarea para ese usuario si así se lo pongo al crear la flag».
-- public.revisiones: es_tarea (false por defecto: las marcas que hay no cambian) y tarea_hasta (para cuándo).
-- Escribe: 2 columnas (frena si ya existían). Deshacer: 125-revisiones-tarea-deshacer.sql.
-- Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'revisiones'
             and column_name in ('es_tarea', 'tarea_hasta')) then
    raise exception 'public.revisiones ya tiene es_tarea / tarea_hasta: no se corre. Avisar antes de seguir.';
  end if;
end $$;
alter table public.revisiones
  add column es_tarea boolean not null default false,
  add column tarea_hasta date;
comment on column public.revisiones.es_tarea is '[script 125] A-FEAT-1411 — la marca es una tarea para quien está asignada (va a su Principal).';
comment on column public.revisiones.tarea_hasta is '[script 125] A-FEAT-1411 — para cuándo (día de calendario, hora argentina).';
commit;
