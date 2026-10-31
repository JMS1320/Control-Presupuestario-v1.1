-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 📬 Script 147 — Mails: TIPOS editables (A-FEAT-1440) + SEGUIMIENTO pendiente / terminado (A-FEAT-1437)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-31 (terminal GAS, camino 2): «ok a las dos, avanzá con la tanda 2» (nota y fecha de seguimiento) ·
-- «la propuesta es correcta» (tipos editables desde la misma lista, sin ir a otra pantalla).
--
-- 1 · public.mails_tipos — el maestro de tipos («grupos») de mail. Hasta acá eran 12 fijos (un CHECK en mails_reglas
--     y una lista en el código). Arranca con esos 12; se crean y renombran desde la app.
--     mails_reglas.tipo, mails_registro.tipo y mails_registro.tipo_manual pasan a apuntar al maestro (FK, on update
--     cascade): un tipo no se usa si no existe antes (CLAUDE.md § Templates — su maestro).
-- 2 · Seguimiento de cada mail recibido: seguimiento (null = sin marcar · 'pendiente' · 'terminado'), la nota de qué
--     falta, la fecha de seguimiento y cuándo se marcó. Columnas aparte de `estado` (que es del procesamiento).
--     Un mail que entra con acción «avisar» nace PENDIENTE (trigger), y los 46 «avisar» ya registrados pasan a
--     pendiente acá. El GAS inserta con «ignore-duplicates»: nunca pisa un seguimiento ya puesto.
--
-- Escribe: 1 tabla nueva (FRENA si existe) con 12 filas + 1 en recurso_tablas, 4 columnas nuevas (FRENA si alguna
-- existe), 1 función + 1 trigger, cambia el CHECK de mails_reglas.tipo por FK, y marca pendientes los 46 «avisar».
-- Deshacer: 147-mails-tipos-y-seguimiento-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.mails_tipos') is not null then raise exception 'mails_tipos YA EXISTE: no se corre nada.'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mails_registro'
             and column_name in ('seguimiento','seguimiento_nota','seguimiento_fecha','seguimiento_at')) then
    raise exception 'mails_registro ya tiene columnas de seguimiento: no se corre nada.';
  end if;
end $$;

-- ── 1 · Tipos ────────────────────────────────────────────────────────────────────────────────────────────────
create table public.mails_tipos (
  id text primary key check (id ~ '^[a-z0-9_]+$'),   -- clave corta, la genera la app desde el nombre
  nombre text not null unique,
  orden int not null default 100,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.mails_tipos is '[script 147] A-FEAT-1440 — maestro de tipos de mail, editable desde la app (antes 12 fijos).';

insert into public.mails_tipos (id, nombre, orden, nota) values
  ('impuestos', 'Impuestos', 10, '[script 147]'), ('contador', 'Contadores', 20, '[script 147]'),
  ('legal', 'Legal / sucesión', 30, '[script 147]'), ('productivo', 'Productivo', 40, '[script 147]'),
  ('factura', 'Facturas', 50, '[script 147]'), ('banco', 'Bancos', 60, '[script 147]'),
  ('seguros', 'Seguros', 70, '[script 147]'), ('servicios', 'Servicios e inmuebles', 80, '[script 147]'),
  ('interno', 'Interno', 90, '[script 147]'), ('otro', 'Otros', 100, '[script 147]'),
  ('notificacion', 'Notificaciones', 110, '[script 147]'), ('propaganda', 'Propaganda', 120, '[script 147]');

alter table public.mails_tipos enable row level security;
create policy ver_segun_permiso on public.mails_tipos for select to authenticated using (public.puede_ver('public', 'mails_tipos'));
create policy escribir_segun_permiso on public.mails_tipos for all to authenticated
  using (public.puede_escribir('public', 'mails_tipos')) with check (public.puede_escribir('public', 'mails_tipos'));
revoke all on public.mails_tipos from anon;
grant select, insert, update, delete on public.mails_tipos to authenticated;
grant all on public.mails_tipos to service_role;
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
  values ('public', 'mails_tipos', 'importar.mails', '[script 147] Tipos de mail (A-FEAT-1440). Sólo admin, como el registro.', true)
  on conflict do nothing;

-- Que nada quede apuntando a un tipo que no está en el maestro (si hubiera, frena y no cambia nada)
do $$
declare n int;
begin
  select count(*) into n from (
    select tipo t from public.mails_reglas union all select tipo from public.mails_registro union all select tipo_manual from public.mails_registro
  ) x where t is not null and t not in (select id from public.mails_tipos);
  if n > 0 then raise exception '% filas con un tipo fuera de los 12: no se corre nada.', n; end if;
end $$;

alter table public.mails_reglas drop constraint mails_reglas_tipo_check;
alter table public.mails_reglas add constraint mails_reglas_tipo_fk foreign key (tipo) references public.mails_tipos(id) on update cascade;
alter table public.mails_registro add constraint mails_registro_tipo_fk foreign key (tipo) references public.mails_tipos(id) on update cascade;
alter table public.mails_registro add constraint mails_registro_tipo_manual_fk foreign key (tipo_manual) references public.mails_tipos(id) on update cascade;

-- ── 2 · Seguimiento ─────────────────────────────────────────────────────────────────────────────────────────
alter table public.mails_registro
  add column seguimiento text check (seguimiento in ('pendiente','terminado')),
  add column seguimiento_nota text,
  add column seguimiento_fecha date,
  add column seguimiento_at timestamptz;
comment on column public.mails_registro.seguimiento is '[script 147] A-FEAT-1437 — null = sin marcar · pendiente (con nota y fecha) · terminado.';
create index mails_registro_pendientes on public.mails_registro (seguimiento_fecha) where seguimiento = 'pendiente';

create function public.mails_registro_seguimiento_inicial() returns trigger
language plpgsql set search_path = public as $$
begin
  -- [script 147] Lo que la regla manda «avisar» nace pendiente, para que no se pierda entre los demás
  if new.seguimiento is null and new.accion = 'avisar' and new.sentido = 'recibido' then
    new.seguimiento := 'pendiente';
    new.seguimiento_at := now();
  end if;
  return new;
end $$;
create trigger mails_registro_seguimiento_inicial before insert on public.mails_registro
  for each row execute function public.mails_registro_seguimiento_inicial();

update public.mails_registro set seguimiento = 'pendiente', seguimiento_at = now()
 where accion = 'avisar' and sentido = 'recibido' and seguimiento is null;

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee) ───────────────────────────────────────────────────────────────────────────────────────
select (select count(*) from public.mails_tipos) as tipos,                                          -- 12
       (select count(*) from public.mails_registro where seguimiento = 'pendiente') as pendientes,   -- 46 (o más, si entraron)
       (select count(*) from public.mails_registro where accion = 'avisar' and sentido = 'recibido' and seguimiento is null) as avisar_sin_marcar, -- 0
       (select count(*) from public.recurso_tablas where tabla = 'mails_tipos') as en_recursos;     -- 1
