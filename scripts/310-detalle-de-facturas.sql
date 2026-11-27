-- [script 310] ESTRUCTURA — el detalle de las facturas, artículo por artículo (A-FEAT-1651 etapa 2; JMS 26/11: «Q9 sí, avanzá»).
-- Capa NUEVA encima de las facturas: no modifica ninguna tabla existente. Aviso previo en ENTRE-DESARROLLADORES.md.
-- Deshacer: scripts/310-detalle-de-facturas-deshacer.sql (las dos tablas no existían antes: verificado el 26/11).
begin;

-- Una fila por factura leída: qué formato se usó, si el control cierra y qué no se leyó.
create table if not exists public.factura_lecturas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (empresa in ('MSA','PAM','MA')),
  comprobante_id uuid not null,
  file_id text,
  formato text,
  moneda text not null default 'ARS',
  tipo_cambio numeric,
  estado text not null check (estado in ('cierra','no-cierra','sin-control','sin-renglones','sin-pdf','sin-texto')),
  suma_renglones numeric, neto_pie numeric, total_pie numeric, total_conocido numeric, dif_neto numeric, dif_total numeric,
  mensajes jsonb not null default '[]'::jsonb,
  no_leido jsonb not null default '[]'::jsonb,
  leido_at timestamptz not null default now(),
  leido_por text,
  updated_at timestamptz not null default now(),
  unique (empresa, comprobante_id)
);

-- Un renglón por artículo. `leido` guarda lo que leyó la app tal cual; si alguien corrige, el renglón cambia y queda la huella.
create table if not exists public.factura_renglones (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (empresa in ('MSA','PAM','MA')),
  comprobante_id uuid not null,
  n int not null,
  codigo text,
  descripcion text not null,
  cantidad numeric,
  unidad text,
  precio_unitario numeric,
  bonif_pct numeric,
  neto numeric,
  alicuota_iva numeric,
  total_con_iva numeric,
  insumo_stock_id uuid references productivo.stock_insumos(id) on delete set null,
  origen text not null default 'lector' check (origen in ('lector','manual')),
  leido jsonb,
  avisos jsonb not null default '[]'::jsonb,
  corregido_por text,
  corregido_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa, comprobante_id, n)
);
create index if not exists factura_renglones_comprobante on public.factura_renglones (empresa, comprobante_id);
create index if not exists factura_renglones_insumo on public.factura_renglones (insumo_stock_id);

alter table public.factura_lecturas enable row level security;
alter table public.factura_renglones enable row level security;
create policy ver_segun_permiso on public.factura_lecturas for select to authenticated using (puede_ver('public','factura_lecturas'));
create policy escribir_segun_permiso on public.factura_lecturas for all to authenticated using (puede_escribir('public','factura_lecturas')) with check (puede_escribir('public','factura_lecturas'));
create policy ver_segun_permiso on public.factura_renglones for select to authenticated using (puede_ver('public','factura_renglones'));
create policy escribir_segun_permiso on public.factura_renglones for all to authenticated using (puede_escribir('public','factura_renglones')) with check (puede_escribir('public','factura_renglones'));
grant select, insert, update, delete on public.factura_lecturas, public.factura_renglones to authenticated, service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
select 'public', t, 'productivo', '[script 310] Detalle de facturas de insumos: lo usa Productivo (stock) como entrega_factura.', false
  from unnest(array['factura_lecturas','factura_renglones']) t
 where not exists (select 1 from public.recurso_tablas r where r.schema_nombre = 'public' and r.tabla = t);

commit;
