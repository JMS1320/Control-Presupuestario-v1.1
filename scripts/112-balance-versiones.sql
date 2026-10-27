-- 112 · LAS VERSIONES DE LOS PAPELES DEL BALANCE — A-FEAT-1337 paso 2 (2026-10-27)
--
-- Usuario 2026-10-24: «cada balance tendrá su dato de cada ítem; si se hace query de los datos debería dar lo mismo
-- que el dato fijado, pero el dato fijado debe existir porque es una variable en sí… el export es para el envío pero
-- los datos todos deberán conservarse en la app». Y 2026-10-27: «creo que dijimos que guardaría y no haría falta
-- generar todo cada vez». Decisiones del 27/10: se guarda SÓLO cuando el usuario aprieta «Guardar» (la pantalla dice
-- si lo que se ve está guardado o no), y el Excel queda guardado pero siempre se puede bajar.
--
-- QUÉ HACE: crea DOS tablas nuevas. No toca ninguna tabla existente salvo 2 filas en recurso_tablas.
--   · public.balance_versiones — una fila por versión guardada (v1, v2…) de una empresa + ejercicio: el Excel tal cual
--     (base64), lo traído del sector productivo (stock, precios, insumos, granos, sementeras: así no hay que volver a
--     traerlo) y su estado: guardada → entregada (al contador, a ARCA…) → o anulada, con motivo.
--   · public.balance_version_items — el valor de cada ítem de cada papel en esa versión (papel + clave), para comparar
--     lo que da hoy contra lo guardado y contra lo entregado.
--   · 🔒 LO ENTREGADO QUEDA FIJO: authenticated sólo puede ACTUALIZAR las columnas de estado (no el archivo, ni los
--     ítems, ni lo traído), y un trigger no deja volver de «entregada» a «guardada» ni tocar una «anulada». Los ítems
--     no se actualizan ni se borran (sólo insert). Nada se borra: una versión se ANULA con motivo.
--   · Mismos permisos que balance_datos_usuario (script 100): recurso «extracto», lectura restringida.
--
-- VERIFICADO EN LA BASE, por el propio script: si alguna de las dos tablas ya existe se frena sin tocar nada. Así, si
-- termina, las tablas las creó él, y el comentario '[script 112]' lo deja marcado para el deshacer.
--
-- 🛑 Antes de correr: aviso a Javier en ENTRE-DESARROLLADORES.md (estructura + RLS) y OK del usuario.
-- Deshacer: 112-balance-versiones-deshacer.sql
begin;
do $$
begin
  if to_regclass('public.balance_versiones') is not null or to_regclass('public.balance_version_items') is not null then
    raise exception 'balance_versiones o balance_version_items YA EXISTE: no se corre el 112. Avisar antes de seguir.';
  end if;
  if exists (select 1 from pg_proc where proname = 'balance_versiones_transicion') then
    raise exception 'La función balance_versiones_transicion YA EXISTE: no se corre el 112.';
  end if;
end $$;

create table public.balance_versiones (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  -- el ejercicio (año de cierre: 2026 = ejercicio 25/26 de MSA)
  anio_cierre int not null,
  -- v1, v2… por empresa + ejercicio (lo asigna la app: el siguiente al mayor)
  numero int not null,
  estado text not null default 'guardada' check (estado in ('guardada', 'entregada', 'anulada')),
  -- a quién se entregó: contador · ARCA · otro (texto libre)
  destinatario text,
  nota text,
  -- lo traído del sector productivo al guardar (hacienda, precios, insumos, granos, sementeras), tal cual lo armó la app
  productivo jsonb,
  -- el Excel tal cual se generó al guardar, en base64, y su nombre
  archivo_base64 text,
  archivo_nombre text,
  items_cantidad int not null default 0,
  creada_at timestamptz not null default now(),
  creada_por text,
  entregada_at timestamptz,
  entregada_por text,
  anulada_at timestamptz,
  anulada_por text,
  anulada_motivo text,
  unique (empresa, anio_cierre, numero)
);
comment on table public.balance_versiones is
  '[script 112] A-FEAT-1337 paso 2 — versiones guardadas de los papeles del balance (Excel + lo traído del sector productivo), por empresa + ejercicio. guardada → entregada → (anulada con motivo). Lo entregado queda fijo.';

create table public.balance_version_items (
  version_id uuid not null references public.balance_versiones(id) on delete restrict,
  -- el papel (la solapa): «02 Hacienda», «07 Bancos», «Templates por mes»…
  papel text not null,
  -- qué ítem adentro del papel (estable entre versiones): «Vaca · valuado», «Banco Galicia»…
  clave text not null,
  -- cómo se lee, para mostrarlo
  concepto text not null,
  valor numeric(20, 4),
  -- $ · cabezas · tn · ha · cantidad · comprobantes
  unidad text not null default '$',
  primary key (version_id, papel, clave)
);
comment on table public.balance_version_items is
  '[script 112] A-FEAT-1337 paso 2 — el valor de cada ítem de cada papel en una versión guardada. Sólo insert: no se cambia ni se borra.';

-- 🔒 Lo entregado queda fijo: las transiciones permitidas.
create function public.balance_versiones_transicion() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.estado = 'anulada' then
    raise exception 'Una versión anulada no se modifica.';
  end if;
  if old.estado = 'entregada' and new.estado <> 'anulada' and new.estado <> 'entregada' then
    raise exception 'Una versión entregada no vuelve a guardada: se anula, con motivo.';
  end if;
  if old.estado = 'entregada' and (new.destinatario is distinct from old.destinatario
      or new.entregada_at is distinct from old.entregada_at) then
    raise exception 'Lo entregado queda fijo: no se cambia a quién ni cuándo.';
  end if;
  if new.estado = 'anulada' and coalesce(trim(new.anulada_motivo), '') = '' then
    raise exception 'Para anular una versión hace falta el motivo.';
  end if;
  if new.estado = 'entregada' and coalesce(trim(new.destinatario), '') = '' then
    raise exception 'Para marcar una versión como entregada hace falta a quién.';
  end if;
  return new;
end $$;
comment on function public.balance_versiones_transicion() is '[script 112] A-FEAT-1337 — lo entregado queda fijo.';
create trigger balance_versiones_transicion before update on public.balance_versiones
  for each row execute function public.balance_versiones_transicion();

alter table public.balance_versiones enable row level security;
alter table public.balance_version_items enable row level security;
create policy ver_segun_permiso on public.balance_versiones for select to authenticated
  using (public.puede_ver('public', 'balance_versiones'));
create policy escribir_segun_permiso on public.balance_versiones for all to authenticated
  using (public.puede_escribir('public', 'balance_versiones')) with check (public.puede_escribir('public', 'balance_versiones'));
create policy ver_segun_permiso on public.balance_version_items for select to authenticated
  using (public.puede_ver('public', 'balance_version_items'));
create policy escribir_segun_permiso on public.balance_version_items for all to authenticated
  using (public.puede_escribir('public', 'balance_version_items')) with check (public.puede_escribir('public', 'balance_version_items'));

revoke all on public.balance_versiones from anon;
revoke all on public.balance_version_items from anon;
-- Versiones: se crean y se les cambia SÓLO el estado. El archivo, lo traído y el número no se tocan después.
grant select, insert on public.balance_versiones to authenticated;
grant update (estado, destinatario, nota, entregada_at, entregada_por, anulada_at, anulada_por, anulada_motivo)
  on public.balance_versiones to authenticated;
-- Ítems: sólo se escriben al guardar.
grant select, insert on public.balance_version_items to authenticated;
grant all on public.balance_versiones to service_role;
grant all on public.balance_version_items to service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('public', 'balance_versiones', 'extracto', '[script 112] Papeles del balance (A-FEAT-1337 paso 2): versiones guardadas y entregadas.', true),
  ('public', 'balance_version_items', 'extracto', '[script 112] Papeles del balance (A-FEAT-1337 paso 2): ítems de cada versión.', true)
on conflict do nothing;
commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee): las dos tablas existen, vacías, marcadas, con RLS y en recurso_tablas ─────────────────────
select (select count(*) from public.balance_versiones) as versiones,
       (select count(*) from public.balance_version_items) as items,
       obj_description('public.balance_versiones'::regclass) like '[script 112]%'
         and obj_description('public.balance_version_items'::regclass) like '[script 112]%' as marcadas,
       (select bool_and(relrowsecurity) from pg_class
          where oid in ('public.balance_versiones'::regclass, 'public.balance_version_items'::regclass)) as rls,
       (select count(*) from public.recurso_tablas where tabla in ('balance_versiones', 'balance_version_items')) as en_recursos;
