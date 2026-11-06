-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 📎 Script 211 — A-FEAT-1571: EL DOCUMENTO QUE RESPALDA CADA SALDO — tabla nueva `public.documentos_respaldo`
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-11-06: «cuando vea saldos, si pudiera apretar para ver el resumen (previamente ya vinculado)» · y a la
-- pregunta de la tabla: «sí, avisale [a Javier] y mostrame».
--
-- Una fila por documento (extracto, resumen de la cuenta en dólares, resumen del fondo, resumen de tarjeta, arqueo)
-- de una cuenta y un mes. El archivo vive UNA vez en su carpeta del Drive (la del banco: «BANCOS y entidades
-- financieras / <banco> / extractos 25-26 / …»); acá queda el vínculo: cuenta + mes → id del archivo.
--   · `cuenta` = el nombre de la cuenta como lo usa la app (el de CUENTAS_DEL_EXTRACTO / cuentas en dólares).
--   · Se guarda el ID del archivo en el Drive, no sólo el link: si se mueve o se renombra, sigue valiendo.
--   · `saldo_documento`: el saldo que dice el papel (opcional) — para el control «el saldo de la app = el del extracto».
--
-- Escribe: crea la tabla (FRENA si existe), vacía, + 1 fila en recurso_tablas (recurso `extracto`, como los papeles
-- del balance), todo marcado '[script 211]'. No toca ninguna tabla ni fila existente.
-- Deshacer: 211-documentos-respaldo-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.documentos_respaldo') is not null then raise exception 'documentos_respaldo YA EXISTE: no se corre nada.'; end if;
end $$;

create table public.documentos_respaldo (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,                                         -- 'MSA'
  cuenta text not null,                                          -- 'BANCO SANTANDER', 'MSA Cuenta Corriente USD', 'FCI FIMA Premium A'…
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),        -- '2026-06' (el mes que cubre)
  tipo text not null check (tipo in ('extracto','resumen_usd','resumen_fci','resumen_tarjeta','arqueo','otro')),
  drive_file_id text,                                            -- el archivo en el Drive (vacío = todavía no se subió)
  url text,
  nombre_archivo text,
  ruta_drive text,                                               -- dónde quedó (para mostrarlo)
  saldo_documento numeric,                                       -- el saldo que figura en el papel (opcional, para controlar)
  observaciones text,
  creado_por text,                                               -- quién lo vinculó ('[script N] …', 'JMS desde la app'…)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa, cuenta, periodo, tipo)
);
comment on table public.documentos_respaldo is '[script 211] A-FEAT-1571 — qué documento del Drive respalda cada cuenta y mes (extractos, resúmenes, arqueos).';

alter table public.documentos_respaldo enable row level security;
create policy ver_segun_permiso on public.documentos_respaldo for select to authenticated using (public.puede_ver('public', 'documentos_respaldo'));
create policy escribir_segun_permiso on public.documentos_respaldo for all to authenticated
  using (public.puede_escribir('public', 'documentos_respaldo')) with check (public.puede_escribir('public', 'documentos_respaldo'));
revoke all on public.documentos_respaldo from anon;
grant select, insert, update, delete on public.documentos_respaldo to authenticated;
grant all on public.documentos_respaldo to service_role;
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
  values ('public', 'documentos_respaldo', 'extracto', '[script 211] Documento de respaldo de cada cuenta y mes (A-FEAT-1571).', true)
  on conflict do nothing;

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee) ───────────────────────────────────────────────────────────────────────────────────────
select (select count(*) from public.documentos_respaldo) as documentos,                                  -- 0
       (select count(*) from public.recurso_tablas where tabla = 'documentos_respaldo') as en_recursos;   -- 1
