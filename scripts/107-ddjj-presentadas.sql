-- 107 · LO QUE DEVUELVE EL CONTADOR — las DDJJ presentadas, guardadas — A-AUTO-09 paso 2 (2026-10-27)
--
-- Usuario 2026-10-27: «el control es totales contra el total de todo lo que recibimos del contador… ponelo como
-- nuestros requisitos y la app lo guarda y mira si hay error. Deja mensaje de aviso a mí y a Ulises». OK a guardar
-- («1 ok dale»).
--
-- QUÉ HACE (todo NUEVO, no modifica ninguna fila existente salvo 1 renglón en recurso_tablas):
--   public.ddjj_presentadas — una fila por DDJJ presentada (empresa + impuesto + período + secuencia): los TOTALES
--   (libro_iva.xml), los COMPROBANTES declarados (comprobantes_compras.csv) y el RESULTADO de compararla contra el
--   subdiario de la app al momento de cargarla. Una rectificativa es otra secuencia: no pisa la original.
--   La misma DDJJ cargada dos veces no duplica (unique empresa+impuesto+periodo+secuencia; la app hace upsert).
--
-- Permisos: recurso «egresos» (Subdiarios vive ahí), RLS puede_ver/puede_escribir, nada a anon, sin DELETE para
-- authenticated (lo presentado es un hecho: se guarda, no se borra).
--
-- 🛑 Antes de correr: aviso a Javier en ENTRE-DESARROLLADORES.md (estructura + RLS) y OK del usuario.
-- Deshacer: 107-ddjj-presentadas-deshacer.sql

begin;

do $$
begin
  if to_regclass('public.ddjj_presentadas') is not null then
    raise exception 'public.ddjj_presentadas YA EXISTE: no se corre. Avisar antes de seguir.';
  end if;
end $$;

create table public.ddjj_presentadas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (empresa in ('MSA', 'PAM', 'MA')),
  impuesto text not null default 'IVA' check (impuesto in ('IVA', 'IIBB')),
  periodo text not null check (periodo ~ '^\d{6}$'),            -- AAAAMM
  secuencia int not null default 1,                             -- 1 = original; 2+ = rectificativas
  codigo_presentacion text,                                     -- el <codigo> del libro_iva.xml
  nro_transaccion text,                                         -- el de la DDJJ en PDF, cuando se lea
  fecha_presentacion date,
  origen text not null default 'subida' check (origen in ('subida', 'mail')),
  archivo text,                                                 -- nombre del zip / link al adjunto
  totales jsonb not null default '{}'::jsonb,                   -- neto gravado, crédito fiscal, exento, no fiscal…
  comprobantes jsonb not null default '[]'::jsonb,              -- cada comprobante declarado
  resultado jsonb,                                              -- la comparación contra el subdiario al cargar
  coincide boolean,                                             -- el veredicto de esa comparación
  cargado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa, impuesto, periodo, secuencia)
);
comment on table public.ddjj_presentadas is
  '[script 107] A-AUTO-09 — lo que devuelve el contador al presentar (zip del libro IVA de ARCA): totales, comprobantes declarados y el resultado de compararlo con el subdiario de la app. Una fila por empresa + impuesto + período + secuencia.';

alter table public.ddjj_presentadas enable row level security;
create policy ver_segun_permiso on public.ddjj_presentadas for select to authenticated
  using (public.puede_ver('public', 'ddjj_presentadas'));
create policy escribir_segun_permiso on public.ddjj_presentadas for all to authenticated
  using (public.puede_escribir('public', 'ddjj_presentadas')) with check (public.puede_escribir('public', 'ddjj_presentadas'));
revoke all on public.ddjj_presentadas from anon;
grant select, insert, update on public.ddjj_presentadas to authenticated;
grant all on public.ddjj_presentadas to service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('public', 'ddjj_presentadas', 'egresos', '[script 107] DDJJ presentadas que devuelve el contador (A-AUTO-09).', false)
on conflict do nothing;

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee): la tabla existe, vacía, con su marca, su RLS y su recurso ─────────────────────────────
select (select count(*) from public.ddjj_presentadas) as filas,                                         -- 0
       obj_description('public.ddjj_presentadas'::regclass) like '[script 107]%' as marcada,          -- true
       (select relrowsecurity from pg_class where oid = 'public.ddjj_presentadas'::regclass) as rls,  -- true
       (select count(*) from public.recurso_tablas where tabla = 'ddjj_presentadas') as en_recursos;   -- 1
