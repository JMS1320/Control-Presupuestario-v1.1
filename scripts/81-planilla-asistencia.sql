-- 81 · Planilla de asistencia de sueldos — A-FEAT-1259 (2026-10-09)
--
-- Pedido del usuario: «la planilla se llena con los francos trabajados y se da un click para llenar el resto con
-- presente… F = 1 franco tomado, 1/2 = medio día trabajado… los sábados es medio franco, el domingo entero… los
-- feriados son como domingos». El cálculo vive en lib/sueldos/asistencia.ts; acá sólo el dato.
--
-- · sueldos.asistencia: UNA marca por empleado y día. P presente · F franco tomado · M medio día trabajado (½) ·
--   V vacaciones · L licencia. Un día sin fila = sin marcar (la planilla lo muestra vacío).
--   Se expone por la vista public.sueldos_asistencia, como el resto del schema sueldos (la app escribe por la vista).
-- · public.feriados: feriados nacionales precargados (fuente: api.argentinadatos.com, 2025–2027) + los que el
--   usuario agregue. `cuenta` = si se trata como domingo: los PUENTES turísticos se cargan con cuenta = false
--   (no son feriado para el empleador privado) y se habilitan a mano si se dieron.
-- Permisos: el mismo patrón que las demás tablas de sueldos (RLS tiene_rol(), nada a anon). Avisado a Javier antes
-- (ENTRE-DESARROLLADORES.md).

begin;

create table if not exists sueldos.asistencia (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references sueldos.empleados(id) on delete cascade,
  fecha date not null,
  marca text not null check (marca in ('P', 'F', 'M', 'V', 'L')),
  updated_at timestamptz not null default now(),
  unique (empleado_id, fecha)
);
create index if not exists asistencia_fecha on sueldos.asistencia (fecha);
comment on table sueldos.asistencia is
  'A-FEAT-1259 — planilla de asistencia: una marca por empleado y día (P presente · F franco tomado · M medio día · V vacaciones · L licencia).';
alter table sueldos.asistencia enable row level security;
create policy solo_usuarios_habilitados on sueldos.asistencia for all to authenticated using (public.tiene_rol()) with check (public.tiene_rol());
revoke all on sueldos.asistencia from anon;
grant select, insert, update, delete on sueldos.asistencia to authenticated;
grant all on sueldos.asistencia to service_role;

create or replace view public.sueldos_asistencia as
  select id, empleado_id, fecha, marca, updated_at from sueldos.asistencia;
revoke all on public.sueldos_asistencia from anon;
grant select, insert, update, delete on public.sueldos_asistencia to authenticated;
grant all on public.sueldos_asistencia to service_role;

create table if not exists public.feriados (
  fecha date primary key,
  nombre text not null,
  tipo text not null default 'manual' check (tipo in ('inamovible', 'trasladable', 'puente', 'manual')),
  cuenta boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.feriados is
  'A-FEAT-1259 — feriados: en la planilla de asistencia un feriado con cuenta = true se trata como domingo. Puentes con cuenta = false.';
alter table public.feriados enable row level security;
create policy solo_usuarios_habilitados on public.feriados for all to authenticated using (public.tiene_rol()) with check (public.tiene_rol());
revoke all on public.feriados from anon;
grant select, insert, update, delete on public.feriados to authenticated;
grant all on public.feriados to service_role;

insert into public.feriados (fecha, nombre, tipo, cuenta) values
  ('2025-01-01', 'Año nuevo', 'inamovible', true),
  ('2025-03-03', 'Carnaval', 'inamovible', true),
  ('2025-03-04', 'Carnaval', 'inamovible', true),
  ('2025-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true),
  ('2025-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true),
  ('2025-04-18', 'Viernes Santo', 'inamovible', true),
  ('2025-05-01', 'Día del Trabajador', 'inamovible', true),
  ('2025-05-02', 'Puente turístico no laborable', 'puente', false),
  ('2025-05-25', 'Día de la Revolución de Mayo', 'inamovible', true),
  ('2025-06-16', 'Paso a la Inmortalidad del General Martín Güemes', 'trasladable', true),
  ('2025-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true),
  ('2025-07-09', 'Día de la Independencia', 'inamovible', true),
  ('2025-08-15', 'Puente turístico no laborable', 'puente', false),
  ('2025-08-17', 'Paso a la Inmortalidad del Gral. José de San Martín', 'trasladable', true),
  ('2025-10-10', 'Puente turístico no laborable', 'puente', false),
  ('2025-10-12', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true),
  ('2025-11-21', 'Puente turístico no laborable', 'puente', false),
  ('2025-11-24', 'Día de la Soberanía Nacional', 'trasladable', true),
  ('2025-12-08', 'Día de la Inmaculada Concepción de María', 'inamovible', true),
  ('2025-12-25', 'Navidad', 'inamovible', true),
  ('2026-01-01', 'Año nuevo', 'inamovible', true),
  ('2026-02-16', 'Carnaval', 'inamovible', true),
  ('2026-02-17', 'Carnaval', 'inamovible', true),
  ('2026-03-23', 'Puente turístico no laborable', 'puente', false),
  ('2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true),
  ('2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true),
  ('2026-04-03', 'Viernes Santo', 'inamovible', true),
  ('2026-05-01', 'Día del Trabajador', 'inamovible', true),
  ('2026-05-25', 'Día de la Revolución de Mayo', 'inamovible', true),
  ('2026-06-15', 'Paso a la Inmortalidad del General Martín Güemes (17/6)', 'trasladable', true),
  ('2026-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true),
  ('2026-07-09', 'Día de la Independencia', 'inamovible', true),
  ('2026-07-10', 'Puente turístico no laborable', 'puente', false),
  ('2026-08-17', 'Paso a la Inmortalidad del Gral. José de San Martín', 'trasladable', true),
  ('2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true),
  ('2026-11-09', 'Visita del papa León XIV', 'inamovible', true),
  ('2026-11-23', 'Día de la Soberanía Nacional (20/11)', 'trasladable', true),
  ('2026-12-07', 'Puente turístico no laborable', 'puente', false),
  ('2026-12-08', 'Día de la Inmaculada Concepción de María', 'inamovible', true),
  ('2026-12-25', 'Navidad', 'inamovible', true),
  ('2027-01-01', 'Año nuevo', 'inamovible', true),
  ('2027-02-08', 'Carnaval', 'inamovible', true),
  ('2027-02-09', 'Carnaval', 'inamovible', true),
  ('2027-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true),
  ('2027-03-26', 'Viernes Santo', 'inamovible', true),
  ('2027-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true),
  ('2027-05-01', 'Día del Trabajador', 'inamovible', true),
  ('2027-05-25', 'Día de la Revolución de Mayo', 'inamovible', true),
  ('2027-06-17', 'Paso a la Inmortalidad del General Martín Güemes', 'trasladable', true),
  ('2027-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true),
  ('2027-07-09', 'Día de la Independencia', 'inamovible', true),
  ('2027-08-17', 'Paso a la Inmortalidad del Gral. José de San Martín', 'trasladable', true),
  ('2027-10-12', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true),
  ('2027-11-20', 'Día de la Soberanía Nacional', 'trasladable', true),
  ('2027-12-08', 'Día de la Inmaculada Concepción de María', 'inamovible', true),
  ('2027-12-25', 'Navidad', 'inamovible', true)
on conflict (fecha) do nothing;

commit;
notify pgrst, 'reload schema';
