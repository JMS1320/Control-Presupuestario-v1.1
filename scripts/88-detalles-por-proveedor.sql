-- 88 · Detalle fijo por proveedor — A-FEAT-1296 (2026-10-20)
--
-- Pedido del usuario: «llenar el detalle siempre igual para ciertas facturas» (luz, teléfono, peajes), marcándolo
-- desde la conciliación con un tilde opcional. Un proveedor puede tener VARIOS renglones (varios suministros: Coopser
-- tiene la del casco y la de la portería, mismo CUIT); se distinguen por el MONTO de referencia, que se actualiza con
-- la última factura en la que se usó. Se aplica sólo si el detalle está vacío o es el autogenerado «FC N - EMISOR».
--
-- ADITIVO: tabla nueva, no toca filas existentes. Mismos permisos que ajustes_balance (script 86): recurso
-- «extracto». ⚠️ Aviso a Javier en ENTRE-DESARROLLADORES.md (2026-10-20). Se corre con JMS presente.
-- Revert: scripts/88-detalles-por-proveedor-deshacer.sql

begin;

create table if not exists public.detalles_por_proveedor (
  id uuid primary key default gen_random_uuid(),
  -- el CUIT sin guiones, como en comprobantes_arca.cuit
  cuit text not null,
  detalle text not null check (length(trim(detalle)) > 0),
  -- para elegir entre varios suministros del mismo proveedor: el de monto más cercano (±30 %)
  monto_referencia numeric(16, 2),
  activo boolean not null default true,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists detalles_por_proveedor_cuit_detalle on public.detalles_por_proveedor (cuit, lower(detalle));
comment on table public.detalles_por_proveedor is
  'A-FEAT-1296 — detalle fijo por proveedor (varios renglones = varios suministros, elegidos por monto). Se marca desde la conciliación.';

alter table public.detalles_por_proveedor enable row level security;
create policy ver_segun_permiso on public.detalles_por_proveedor for select to authenticated using (public.puede_ver('public', 'detalles_por_proveedor'));
create policy escribir_segun_permiso on public.detalles_por_proveedor for all to authenticated
  using (public.puede_escribir('public', 'detalles_por_proveedor')) with check (public.puede_escribir('public', 'detalles_por_proveedor'));
revoke all on public.detalles_por_proveedor from anon;
grant select, insert, update on public.detalles_por_proveedor to authenticated;
grant all on public.detalles_por_proveedor to service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('public', 'detalles_por_proveedor', 'extracto', 'Detalle fijo por proveedor que usa la conciliación (A-FEAT-1296).', false)
on conflict do nothing;

commit;
notify pgrst, 'reload schema';

-- Verificación (sin escribir): tiene que devolver 7 columnas.
-- select column_name from information_schema.columns where table_schema = 'public' and table_name = 'detalles_por_proveedor';
