-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 75 · EL BALANCE PROPIO COMO FOTO GUARDADA                       A-FEAT-1190 · A-DEC-1001 · 2026-10-03
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Pedido del usuario: *«cuando ponemos los montos de un balance ya sean un dato duro en BBDD, si
-- luego algo se altera ese dato no cambia, a lo sumo puede dar alerta. Tendríamos dato para balance
-- contador, dato para balance JMS. A veces tendremos datos como según SENASA»*.
--
--   · `balance_fotos`        → una por (empresa, fecha de cierre), con el TC de ESA fecha guardado
--                              (si se reimporta una cotización, los US$ de la foto no se mueven).
--   · `balance_foto_valores` → un importe en PESOS por (foto, renglón, versión). Los renglones y su
--                              rubro viven en `lib/balance/balance-propio.ts` (la solapa NOTAS).
--                              `origen` dice de dónde salió y `valor_sistema` guarda cuánto decía el
--                              sistema el día de la foto: es lo que permite AVISAR después sin tocarla.
--
-- Permisos: RLS por sección, recurso `extracto` (Reportes vive ahí), con lectura RESTRINGIDA — es
-- el análisis patrimonial del dueño. Registrado en `recurso_tablas` en el mismo script (A-SEC-14).
-- Avisado a Javier ANTES de correrlo (ENTRE-DESARROLLADORES).
-- 🔙 Deshacer: `scripts/75-balance-propio-deshacer.sql`.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.balance_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (empresa in ('MSA', 'PAM', 'MA')),
  fecha_cierre date not null,
  tc numeric,
  tc_fuente text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa, fecha_cierre)
);

create table if not exists public.balance_foto_valores (
  id uuid primary key default gen_random_uuid(),
  foto_id uuid not null references public.balance_fotos(id) on delete cascade,
  renglon text not null,
  version text not null check (version in ('contador', 'jms', 'sistema', 'senasa')),
  importe numeric not null,
  origen text not null default 'manual' check (origen in ('manual', 'planilla', 'sistema')),
  valor_sistema numeric,
  detalle text,
  updated_at timestamptz not null default now(),
  unique (foto_id, renglon, version)
);

comment on table public.balance_fotos is
  'A-FEAT-1190 / A-DEC-1001 — balance propio: una foto por empresa y fecha de cierre. Dato duro: no se recalcula; el cierre de una es el inicio de la siguiente.';
comment on table public.balance_foto_valores is
  'A-FEAT-1190 — importe en pesos por renglón (catálogo en lib/balance/balance-propio.ts) y versión (contador / jms / sistema / senasa). valor_sistema = lo que decía el sistema el día de la foto, para avisar si cambia.';

do $$
declare t text;
begin
  foreach t in array array['balance_fotos', 'balance_foto_valores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy ver_segun_permiso on public.%I for select to authenticated using (public.puede_ver(''public'', %L))', t, t);
    execute format('create policy escribir_segun_permiso on public.%I for all to authenticated using (public.puede_escribir(''public'', %L)) with check (public.puede_escribir(''public'', %L))', t, t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('public', 'balance_fotos', 'extracto', 'Balance propio (A-FEAT-1190): fotos de cierre por empresa.', true),
  ('public', 'balance_foto_valores', 'extracto', 'Balance propio (A-FEAT-1190): importes por renglón y versión.', true)
on conflict do nothing;

commit;

notify pgrst, 'reload schema';
