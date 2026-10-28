-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔓 Script 123 — A-FEAT-1400 + A-DEC-1023/1024: PROPUESTAS DE CAMBIO (Ulises corrige, JMS acepta)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-28: «le marco a Ulises un flag rojo y le dejo habilitada esa factura para modificar. Él la
-- modifica y la confirma; eso queda pendiente de mi confirmación, así que no impacta en la base… como Enrique».
-- Regla general (A-DEC-1024): todo lo que carga alguien que no es JMS queda pendiente de su OK.
--
-- Una fila = una habilitación sobre UN registro (hoy: una factura de comprobantes_arca, de una empresa):
--   habilitada (JMS la dio) → propuesta (la persona cargó sus cambios) → aceptada / revertida, o vencida/cancelada.
-- Los cambios propuestos viven ACÁ (`antes` / `cambios`): la factura NO se toca hasta que JMS acepta, y al
-- aceptar se aplican por el camino de siempre de la pantalla (cuenta contable con su propagación, el trigger
-- del mes a rectificar, etc.). Es genérica (tabla + registro) para replicar el patrón en otras pantallas.
--
-- 🔒 RLS: el admin ve y escribe todo; la persona habilitada ve las suyas y sólo puede dejarlas en
-- «habilitada» o «propuesta» (no puede aceptarse a sí misma). Una sola habilitación abierta por registro.
--
-- Escribe: crea la tabla (frena si existe). Deshacer: 123-propuestas-cambio-deshacer.sql.
-- Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo (toca permisos: RLS nueva).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.propuestas_cambio') is not null then
    raise exception 'public.propuestas_cambio YA EXISTE: no se corre. Avisar antes de seguir.';
  end if;
end $$;

create table public.propuestas_cambio (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (empresa in ('MSA', 'PAM', 'MA')),
  tabla text not null default 'comprobantes_arca',
  registro_id uuid not null,
  persona text not null,                       -- mail de quien queda habilitado
  habilitada_por text,
  nota text,
  vence_at timestamptz,                        -- null = «hasta que JMS acepte»
  estado text not null default 'habilitada'
    check (estado in ('habilitada', 'propuesta', 'aceptada', 'revertida', 'vencida', 'cancelada')),
  antes jsonb,                                 -- lo que tenía el registro en los campos que se proponen cambiar
  cambios jsonb,                               -- { campo: valor nuevo }
  revision_id uuid,                            -- la 🚩 que la acompaña
  created_at timestamptz not null default now(),
  propuesta_at timestamptz,
  resuelta_at timestamptz,
  resuelta_por text,
  resolucion text
);
comment on table public.propuestas_cambio is
  '[script 123] A-FEAT-1400 — habilitación puntual sobre un registro: la persona propone, JMS acepta o revierte. Nada se aplica antes del OK.';
create unique index propuestas_cambio_una_abierta on public.propuestas_cambio (tabla, registro_id)
  where estado in ('habilitada', 'propuesta');
create index propuestas_cambio_persona on public.propuestas_cambio (persona, estado);

alter table public.propuestas_cambio enable row level security;
create policy admin_todo on public.propuestas_cambio for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy persona_ve_las_suyas on public.propuestas_cambio for select to authenticated
  using (lower(persona) = lower(auth.jwt() ->> 'email'));
create policy persona_propone on public.propuestas_cambio for update to authenticated
  using (lower(persona) = lower(auth.jwt() ->> 'email') and estado in ('habilitada', 'propuesta')
         and (vence_at is null or vence_at > now()))
  with check (lower(persona) = lower(auth.jwt() ->> 'email') and estado in ('habilitada', 'propuesta'));
revoke all on public.propuestas_cambio from anon;
grant select, insert, update on public.propuestas_cambio to authenticated;
grant all on public.propuestas_cambio to service_role;

commit;
