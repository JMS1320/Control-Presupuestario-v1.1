-- 91 · Registro del ARCHIVO DIGITAL (A-FEAT-1287, pedido del usuario 2026-10-22)
--
-- «que haya un registro como del mail pero del archivo digital… cuando mira un pdf sin vincular que no
-- corresponde, le toma los datos y lo guarda… esto puede ayudar si una fc se guardó mal».
--
-- Un renglón por archivo de Drive que la app LEYÓ (OCR) al buscar en una carpeta: qué dice y en qué
-- carpeta está. Sirve para dos cosas:
--   1. no volver a leerlo la próxima vez (se cruza con lo guardado: instantáneo);
--   2. si una factura imputada no está en la carpeta de su subdiario, encontrarla en OTRA carpeta.
-- Los archivos ya vinculados a una factura no se leen, así que no están acá.
--
-- Permisos: igual que arca_pdf_busqueda_log / arca_pdf_inventario.

create table if not exists public.arca_pdf_archivo_digital (
  id             uuid primary key default gen_random_uuid(),
  file_id        text not null unique,          -- id del archivo en Drive (sobrevive a moverlo de carpeta)
  empresa        text not null,                  -- MSA / PAM / MA
  carpeta        text,                           -- dónde estaba al leerlo: «2025-2026/26-03»
  nombre_archivo text,
  url            text,
  estado         text not null,                  -- 'leido' | 'ilegible' | 'error'
  chars          int,
  texto          text,
  texto_digitos  text,                           -- sólo los dígitos, para el prefiltro por CUIT
  observaciones  text,
  leido_at       timestamptz not null default now(),
  leido_por      text
);
create index if not exists arca_pdf_archivo_digital_emp_idx on public.arca_pdf_archivo_digital (empresa, carpeta);

alter table public.arca_pdf_archivo_digital enable row level security;
create policy ver_segun_permiso on public.arca_pdf_archivo_digital for select to authenticated
  using (puede_ver('public', 'arca_pdf_archivo_digital'));
create policy escribir_segun_permiso on public.arca_pdf_archivo_digital for all to authenticated
  using (puede_escribir('public', 'arca_pdf_archivo_digital')) with check (puede_escribir('public', 'arca_pdf_archivo_digital'));
revoke all on public.arca_pdf_archivo_digital from anon;
grant select, insert, update, delete on public.arca_pdf_archivo_digital to authenticated;
notify pgrst, 'reload schema';
