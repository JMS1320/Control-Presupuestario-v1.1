-- 100 · LO QUE CARGA EL USUARIO EN LOS PAPELES DEL BALANCE — A-FEAT-1337 paso 1 (2026-10-24)
--
-- Usuario 2026-10-24: «el trabajo de balance uno lo va haciendo en diferentes días… pretende que no se pierda.
-- Son un set de datos que tienen que quedar registrados… eso de que los precios que puse se borren está mal».
--
-- QUÉ HACE: crea UNA tabla nueva, public.balance_datos_usuario. Una fila por empresa + ejercicio + papel + clave
-- (ej. MSA · 2026 · hacienda.precio · «Vaca»), con lo que escribió el usuario (texto), el número leído (valor) y
-- la huella de cada cambio (historial). No toca ninguna tabla existente salvo 1 fila en recurso_tablas.
--   · Mismos permisos que ajustes_balance (script 86): recurso «extracto», lectura restringida.
--   · Sin DELETE para authenticated: vaciar una casilla deja la fila con texto vacío (nada destructivo).
--
-- VERIFICADO EN LA BASE, por el propio script: si la tabla ya existe se frena sin tocar nada. Así, si termina,
-- la tabla la creó él, y el comentario '[script 100]' lo deja marcado para el deshacer.
--
-- 🛑 Antes de correr: aviso a Javier en ENTRE-DESARROLLADORES.md (estructura + RLS) y OK del usuario.
-- Deshacer: 100-balance-datos-usuario-deshacer.sql

begin;

do $$
begin
  if to_regclass('public.balance_datos_usuario') is not null then
    raise exception 'public.balance_datos_usuario YA EXISTE: no se corre el 100. Avisar antes de seguir.';
  end if;
end $$;

create table public.balance_datos_usuario (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  -- el ejercicio (año de cierre: 2026 = ejercicio 25/26 de MSA)
  anio_cierre int not null,
  -- de qué papel es: hacienda.precio · granos · fci (lo define la app)
  papel text not null,
  -- qué casilla: la categoría de hacienda, «inicio», «cuotapartes»…
  clave text not null,
  -- lo que escribió el usuario, tal cual (null = casilla vacía)
  texto text,
  -- el número leído de ese texto (es-AR); null = vacío o ilegible
  valor numeric(20, 4),
  -- la huella: cada cambio deja el valor anterior [{texto, valor, at, por}]
  historial jsonb not null default '[]'::jsonb,
  actualizado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa, anio_cierre, papel, clave)
);
comment on table public.balance_datos_usuario is
  '[script 100] A-FEAT-1337 — lo que carga el usuario en los papeles del balance (precios a mano, cuadre de granos, cuotapartes), por empresa + ejercicio + papel + clave. Se guarda al escribir; lo automático no va acá.';

alter table public.balance_datos_usuario enable row level security;
create policy ver_segun_permiso on public.balance_datos_usuario for select to authenticated
  using (public.puede_ver('public', 'balance_datos_usuario'));
create policy escribir_segun_permiso on public.balance_datos_usuario for all to authenticated
  using (public.puede_escribir('public', 'balance_datos_usuario')) with check (public.puede_escribir('public', 'balance_datos_usuario'));
revoke all on public.balance_datos_usuario from anon;
grant select, insert, update on public.balance_datos_usuario to authenticated;
grant all on public.balance_datos_usuario to service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('public', 'balance_datos_usuario', 'extracto', '[script 100] Papeles del balance (A-FEAT-1337): lo que carga el usuario.', true)
on conflict do nothing;

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee): la tabla existe, vacía, con su marca y su RLS ─────────────────────────────
select (select count(*) from public.balance_datos_usuario) as filas,
       obj_description('public.balance_datos_usuario'::regclass) like '[script 100]%' as marcada,
       (select relrowsecurity from pg_class where oid = 'public.balance_datos_usuario'::regclass) as rls,
       (select count(*) from public.recurso_tablas where tabla = 'balance_datos_usuario') as en_recursos;
