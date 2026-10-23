-- 89 · Pólizas de seguro — A-FEAT-1309 (2026-10-20)
--
-- Una faceta NUEVA y aparte: no modifica ninguna tabla existente (OK del usuario 2026-10-20: «podés
-- crear la estructura para esta faceta nueva sí, porque es algo aparte que no modifica datos»).
--
-- Qué guarda (pocas filas por póliza; el PDF sigue en Drive):
--   polizas_seguro        la póliza: número, ramo, vigencia, póliza anterior (la cadena de renovaciones)
--   polizas_endosos       cada endoso = un comprobante: la liquidación, el total, la lectura CRUDA y las
--                         CORRECCIONES del usuario (la huella, § 📄 de CLAUDE.md), y el vínculo a la factura
--   polizas_cuotas        el plan de cuotas de cada endoso
--   polizas_bienes        lo asegurado en cada endoso: vehículo (patente) o persona (DNI), con su prima
--   polizas_responsables  a quién corresponde cada bien, CONTABLE e INTERNO, por patente o DNI — así sigue
--                         valiendo cuando la póliza se renueva. Es el default editable (§ 🎚️): se cargan
--                         las 5 que dijo el usuario; todo lo que no está acá es MSA.
--
-- Permisos: como el script 86 (RLS con puede_ver / puede_escribir) bajo el recurso de las facturas de MSA,
-- que es donde vive la factura de la póliza — así el rol `contable` (Ulises) la puede ver y operar.

begin;

create table if not exists public.polizas_seguro (
  id uuid primary key default gen_random_uuid(),
  empresa text not null default 'MSA',
  aseguradora text not null,
  poliza text not null,
  seccion text,
  producto text,
  poliza_anterior text,
  vigencia_desde date,
  vigencia_hasta date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aseguradora, poliza)
);

create table if not exists public.polizas_endosos (
  id uuid primary key default gen_random_uuid(),
  poliza_id uuid not null references public.polizas_seguro (id) on delete cascade,
  endoso int not null,
  fecha_emision date,
  periodo_desde date,
  periodo_hasta date,
  total numeric(16, 2),
  es_nota_credito boolean not null default false,
  -- la liquidación renglón por renglón (factura) y la resumida (frente), tal como se leyeron
  conceptos jsonb not null default '[]',
  frente jsonb,
  -- foto del pago consolidado que traía el PDF (todas las cuotas vivas con su saldo)
  consolidado jsonb,
  -- el vínculo «esta factura es este endoso»: mismo nombre que en las otras tablas (mapa de propagación).
  -- Sin FK a propósito: la factura vive en el schema de su empresa (msa/pam/ma).
  comprobante_arca_id uuid,
  comprobante_schema text,
  pdf_drive_url text,
  archivo text,
  -- la HUELLA: lo que leyó el lector completo + lo que corrigió el usuario (campo, leído, puesto, cuándo)
  lectura jsonb not null,
  correcciones jsonb not null default '[]',
  controles jsonb not null default '[]',
  procesado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poliza_id, endoso)
);
create index if not exists polizas_endosos_comprobante on public.polizas_endosos (comprobante_arca_id);

create table if not exists public.polizas_cuotas (
  id uuid primary key default gen_random_uuid(),
  endoso_id uuid not null references public.polizas_endosos (id) on delete cascade,
  nro int not null,
  de int not null,
  vencimiento date not null,
  importe numeric(16, 2) not null,
  unique (endoso_id, nro)
);
create index if not exists polizas_cuotas_vencimiento on public.polizas_cuotas (vencimiento);

create table if not exists public.polizas_bienes (
  id uuid primary key default gen_random_uuid(),
  endoso_id uuid not null references public.polizas_endosos (id) on delete cascade,
  tipo text not null check (tipo in ('vehiculo', 'persona')),
  certificado int,
  -- patente (vehículo; null si es maquinaria sin patente) o DNI (persona)
  clave text,
  descripcion text,
  anio int,
  prima numeric(16, 2),
  suma_asegurada numeric(16, 2),
  -- personas: alta / baja / activa (el endoso cobra o devuelve el costo de las que mueve)
  movimiento text check (movimiento in ('alta', 'baja', 'activa')),
  created_at timestamptz not null default now()
);
create index if not exists polizas_bienes_clave on public.polizas_bienes (clave);

create table if not exists public.polizas_responsables (
  clave text primary key,
  tipo text not null check (tipo in ('vehiculo', 'persona')),
  descripcion text,
  responsable_contable text not null default 'MSA',
  responsable_interno text not null default 'MSA',
  motivo text,
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.polizas_responsables is
  'A-FEAT-1309 — a quién corresponde cada bien asegurado (contable e interno), por patente o DNI. Lo que no está acá es MSA.';

-- Los responsables que dio el usuario el 2026-10-20 (dato de arranque, editable desde la app).
insert into public.polizas_responsables (clave, tipo, descripcion, responsable_contable, responsable_interno, motivo) values
  ('LMW911',   'vehiculo', 'VW Tiguan 2012',            'MSA', 'MA',  'Usuario 2026-10-20: interno de MA'),
  ('LFO201',   'vehiculo', 'VW Gol Trend 2012',         'MSA', 'JMS', 'Usuario 2026-10-20: interno de JMS (seguro y automotor)'),
  ('27673775', 'persona',  'PAZ ELVIO CRESENCIO',       'MSA', 'MA',  'Usuario 2026-10-20: responsable interno MA'),
  ('47926088', 'persona',  'OLIVO ALONDRA AYLIN',       'MA',  'MA',  'Usuario 2026-10-20: contable e interno MA'),
  ('20361536', 'persona',  'ROJAS CELIA MABEL',         'PAM', 'PAM', 'Usuario 2026-10-20: contable e interno PAM')
on conflict (clave) do nothing;

-- RLS + permisos (patrón del script 86)
do $$
declare t text;
begin
  foreach t in array array['polizas_seguro', 'polizas_endosos', 'polizas_cuotas', 'polizas_bienes', 'polizas_responsables'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy ver_segun_permiso on public.%I for select to authenticated using (public.puede_ver(''public'', %L))', t, t);
    execute format('create policy escribir_segun_permiso on public.%I for all to authenticated using (public.puede_escribir(''public'', %L)) with check (public.puede_escribir(''public'', %L))', t, t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('public', 'polizas_seguro',       'egresos.facturas-msa', 'Pólizas de seguro (A-FEAT-1309): la factura de la póliza vive en las facturas de MSA.', false),
  ('public', 'polizas_endosos',      'egresos.facturas-msa', 'Pólizas de seguro (A-FEAT-1309): endosos con su lectura y correcciones.', false),
  ('public', 'polizas_cuotas',       'egresos.facturas-msa', 'Pólizas de seguro (A-FEAT-1309): plan de cuotas de cada endoso.', false),
  ('public', 'polizas_bienes',       'egresos.facturas-msa', 'Pólizas de seguro (A-FEAT-1309): vehículos y personas asegurados.', false),
  ('public', 'polizas_responsables', 'egresos.facturas-msa', 'Pólizas de seguro (A-FEAT-1309): responsable contable e interno de cada bien.', false)
on conflict do nothing;

commit;
notify pgrst, 'reload schema';
