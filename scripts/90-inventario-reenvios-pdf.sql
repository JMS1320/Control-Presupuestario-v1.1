-- 90 · Inventario de adjuntos de los reenvíos (A-FEAT-1287, acordado con el usuario 2026-10-20)
--
-- Para qué: buscar el PDF de una factura en los reenvíos de Jose y Andrés leía, POR CADA FACTURA,
-- todos los reenvíos desde la emisión hasta hoy. El mismo PDF se leía una vez por factura del lote
-- y la búsqueda no entraba en el minuto (Sola NC 9-63). Ahora cada adjunto se lee UNA vez y lo que
-- dice queda acá, para siempre: las facturas se cruzan contra este inventario sin volver a leer.
--
--   arca_pdf_inventario      un renglón por adjunto (PDF o imagen) de un mail reenviado, con el texto leído
--   arca_pdf_barrido_tramo   qué días de mail de cada reenviador ya se leyeron enteros («hasta dónde se llegó»)
--
-- Permisos: igual que arca_pdf_busqueda_log (sin recurso propio en recurso_tablas → cualquier rol
-- con sesión escribe; anon nada).

create table if not exists public.arca_pdf_inventario (
  id               uuid primary key default gen_random_uuid(),
  gmail_message_id text not null,
  adjunto_idx      int  not null,               -- posición en msg.getAttachments() (lo que usa el GAS para volver a tomarlo)
  hash             text,                         -- SHA del archivo: el mismo PDF reenviado dos veces es UNO
  nombre_archivo   text,
  tamano           int,
  remitente        text,
  asunto           text,
  fecha_mail       timestamptz,
  recolector       text,                         -- mail del que reenvía (Jose / Andrés)
  estado           text not null,                -- 'leido' | 'ilegible' | 'copia' | 'error'
  chars            int,                          -- largo del texto leído (ilegible = casi nada)
  texto            text,                         -- lo que leyó el OCR: el cruce se rehace con reglas nuevas sin volver a leer
  texto_digitos    text,                         -- sólo los dígitos del texto, para el prefiltro por CUIT
  observaciones    text,
  leido_at         timestamptz not null default now(),
  leido_por        text,
  unique (gmail_message_id, adjunto_idx)
);
create index if not exists arca_pdf_inventario_hash_idx on public.arca_pdf_inventario (hash);
create index if not exists arca_pdf_inventario_fecha_idx on public.arca_pdf_inventario (recolector, fecha_mail);

create table if not exists public.arca_pdf_barrido_tramo (
  id          uuid primary key default gen_random_uuid(),
  recolector  text not null,
  desde       date not null,                     -- primer día de mail leído
  hasta       date not null,                     -- último día de mail leído (inclusive)
  mails       int,
  adjuntos    int,
  hecho_at    timestamptz not null default now(),
  hecho_por   text
);
create index if not exists arca_pdf_barrido_tramo_rec_idx on public.arca_pdf_barrido_tramo (recolector, desde);

alter table public.arca_pdf_inventario enable row level security;
alter table public.arca_pdf_barrido_tramo enable row level security;

create policy ver_segun_permiso on public.arca_pdf_inventario for select to authenticated
  using (puede_ver('public', 'arca_pdf_inventario'));
create policy escribir_segun_permiso on public.arca_pdf_inventario for all to authenticated
  using (puede_escribir('public', 'arca_pdf_inventario')) with check (puede_escribir('public', 'arca_pdf_inventario'));
create policy ver_segun_permiso on public.arca_pdf_barrido_tramo for select to authenticated
  using (puede_ver('public', 'arca_pdf_barrido_tramo'));
create policy escribir_segun_permiso on public.arca_pdf_barrido_tramo for all to authenticated
  using (puede_escribir('public', 'arca_pdf_barrido_tramo')) with check (puede_escribir('public', 'arca_pdf_barrido_tramo'));

revoke all on public.arca_pdf_inventario, public.arca_pdf_barrido_tramo from anon;
grant select, insert, update, delete on public.arca_pdf_inventario, public.arca_pdf_barrido_tramo to authenticated;
