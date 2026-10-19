-- 80 · Pendientes a revisar de los papeles de trabajo del balance — A-FEAT-1258 (2026-10-07)
--
-- Pedido del usuario: «lo de pendientes de papeles de trabajo quiero que sea algo que cuando hago el export
-- salga el pendiente de chequear; y cuando trabajo desde la app con este export, poder agregar pendientes a
-- esta sección; y que quede a la vista al estar trabajando en esto desde la app».
--
-- Una fila por pendiente, por empresa y ejercicio (año de cierre). Se resuelve con un texto de resolución
-- (no se borra: queda la historia de qué se revisó). Mismos permisos que el balance propio (script 75).

begin;

create table if not exists public.balance_pendientes (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  anio_cierre int not null,
  texto text not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'resuelto')),
  resolucion text,
  creado_por text,
  created_at timestamptz not null default now(),
  resuelto_at timestamptz
);
create index if not exists balance_pendientes_empresa_anio on public.balance_pendientes (empresa, anio_cierre);
comment on table public.balance_pendientes is
  'A-FEAT-1258 — pendientes a revisar de los papeles de trabajo del balance: se anotan en la app, se ven al trabajar y salen en el export.';

alter table public.balance_pendientes enable row level security;
create policy ver_segun_permiso on public.balance_pendientes for select to authenticated using (public.puede_ver('public', 'balance_pendientes'));
create policy escribir_segun_permiso on public.balance_pendientes for all to authenticated
  using (public.puede_escribir('public', 'balance_pendientes')) with check (public.puede_escribir('public', 'balance_pendientes'));
revoke all on public.balance_pendientes from anon;
grant select, insert, update, delete on public.balance_pendientes to authenticated;
grant all on public.balance_pendientes to service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('public', 'balance_pendientes', 'extracto', 'Papeles de trabajo del balance (A-FEAT-1258): pendientes a revisar.', true)
on conflict do nothing;

commit;
notify pgrst, 'reload schema';
