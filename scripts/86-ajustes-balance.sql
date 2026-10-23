-- 86 · Ajustes del balance — A-FEAT-1207, VERSIÓN CHICA: los SALDOS DEL EJERCICIO ANTERIOR (2026-10-18)
--
-- Definición del usuario 2026-10-18: un pago anual (ej. inmobiliario 2025 pagado el 21/04/2025) cae por default en
-- el ejercicio en que se pagó; el usuario decide cuánto pasa al ejercicio siguiente, y el balance siguiente lo toma
-- solo como gasto. Para el pasado alcanza con anotar «el saldo que dejó el balance anterior y punto».
--
-- Una sola tabla, la de A-FEAT-1207 («el sistema propone y el usuario dispone, con marca»), para no tener dos
-- mecanismos: hoy se usa sólo la acción `saldo_anterior`; las demás (pasar al próximo, pagado al cierre, excluir…)
-- quedan previstas en el check y se construyen después. Un ajuste no se borra: se ANULA (queda la historia).
-- Mismos permisos que balance_pendientes / balance propio (script 80 / 75): recurso «extracto», lectura restringida.

begin;

create table if not exists public.ajustes_balance (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  -- el ejercicio que TOMA el ajuste (año de cierre: 2026 = ejercicio 25/26 de MSA)
  anio_cierre int not null,
  accion text not null check (accion in ('saldo_anterior', 'pasar_proximo', 'pagado_al_cierre', 'cobrado_al_cierre', 'excluir', 'incluir', 'monto')),
  concepto text not null,
  -- la cuenta (categ) a la que va el gasto
  categ text,
  monto numeric(16, 2) not null,
  -- obligatorio: el papel va a un tercero y sin motivo el ajuste es ilegible en tres semanas
  motivo text not null check (length(trim(motivo)) > 0),
  -- de qué balance viene un saldo (año de cierre)
  origen_anio_cierre int,
  -- la huella: qué decía el sistema cuando se ajustó (para los ajustes sobre un registro)
  valor_sistema numeric(16, 2),
  tabla text,
  registro_id text,
  creado_por text,
  created_at timestamptz not null default now(),
  anulado_at timestamptz,
  anulado_motivo text
);
create index if not exists ajustes_balance_empresa_anio on public.ajustes_balance (empresa, anio_cierre);
comment on table public.ajustes_balance is
  'A-FEAT-1207 — ajustes del balance (el sistema propone y el usuario dispone, con marca). Versión chica 2026-10-18: saldos del ejercicio anterior.';

alter table public.ajustes_balance enable row level security;
create policy ver_segun_permiso on public.ajustes_balance for select to authenticated using (public.puede_ver('public', 'ajustes_balance'));
create policy escribir_segun_permiso on public.ajustes_balance for all to authenticated
  using (public.puede_escribir('public', 'ajustes_balance')) with check (public.puede_escribir('public', 'ajustes_balance'));
revoke all on public.ajustes_balance from anon;
grant select, insert, update on public.ajustes_balance to authenticated;
grant all on public.ajustes_balance to service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('public', 'ajustes_balance', 'extracto', 'Papeles de trabajo del balance (A-FEAT-1207): ajustes y saldos del ejercicio anterior.', true)
on conflict do nothing;

commit;
notify pgrst, 'reload schema';
