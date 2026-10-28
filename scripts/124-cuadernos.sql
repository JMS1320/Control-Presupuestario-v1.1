-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 📓 Script 124 — A-FEAT-1410: EL CUADERNO DE TRABAJO (piloto) — tabla public.cuadernos
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-28: «la posibilidad de hacer anotaciones de trabajo… formato Word y formato Excel. Simularía un
-- cuaderno en mi mano. El documento que se guarda puede ser una combinación de Word con Excel intercalados».
--
-- Un cuaderno = título + `bloques` (jsonb): una lista ordenada de { tipo: 'texto', texto } o
-- { tipo: 'tabla', celdas: string[][] }. Las fórmulas se guardan como texto («=SUMA(B2:B5)») y se calculan en
-- pantalla (lib/cuaderno/formulas.ts).
-- 🔒 Es PERSONAL: cada usuario ve y escribe sólo los suyos (RLS por `usuario_id = auth.uid()`), sin pasar por
-- recurso_tablas (no es un dato de la empresa que se reparta por rol).
--
-- Escribe: crea la tabla (frena si existe). No toca nada más.
-- Deshacer: 124-cuadernos-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.cuadernos') is not null then
    raise exception 'public.cuadernos YA EXISTE: no se corre. Avisar antes de seguir.';
  end if;
end $$;

create table public.cuadernos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid(),
  titulo text not null default 'Sin título',
  bloques jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.cuadernos is
  '[script 124] A-FEAT-1410 — cuaderno de trabajo personal: bloques de texto y tablas intercalados.';
create index cuadernos_usuario on public.cuadernos (usuario_id, updated_at desc);

alter table public.cuadernos enable row level security;
create policy cuadernos_propios on public.cuadernos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
revoke all on public.cuadernos from anon;
grant select, insert, update, delete on public.cuadernos to authenticated;
grant all on public.cuadernos to service_role;

commit;
