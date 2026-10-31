-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 📮 Script 153 — A-FEAT-1449 tanda 3: QUIÉN RECIBE QUÉ y las OBLIGACIONES DE CADA MES
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-31 (vista previa respondida: «quién recibe cada tipo de aviso» → así sí; IIBB e impuestos → JMS; a Ulises:
-- extractos de MSA que no llegan por mail y presentar los Subdiarios los 10 de cada mes con las facturas vinculadas) ·
-- «seguí con la tanda 3». Es la tabla «aviso → destinatarios» que ya pedía A-AUTO-06.
--
-- 1 · public.avisos_destinatarios — tipo de aviso → a quién va por defecto (mails de las cuentas, o 'claude').
--     Arranca con los TIPOS y sin personas: los mails de las personas no van en el repo (es público); los carga JMS desde
--     Egresos → Mails → Reglas, o con la casilla «siempre que sea esto, a esta persona» al pasar una tarea.
-- 2 · public.obligaciones_recurrentes — lo que hay que hacer TODOS LOS MESES antes de un día (A-AUTO-02, el checklist):
--     cada mes se crea sola una tarea (🚩) para quien recibe ese tipo de aviso, con fecha = ese día del mes.
-- 3 · índice único parcial en public.revisiones (tabla_ref, registro_id) para origen 'obligacion': la tarea del mes se
--     crea UNA vez aunque dos pantallas la pidan a la vez.
--
-- Escribe: 2 tablas (FRENA si existen) con sus filas iniciales + 2 filas en recurso_tablas + 1 índice. Todo marcado
-- '[script 153]'. RLS: se leen con cualquier sesión (las usa «Pasarle a…»), se escriben sólo con admin
-- (recurso `importar.avisos`, sin restringir lectura). Deshacer: 153-avisos-destinatarios-y-obligaciones-deshacer.sql.
-- Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;
do $$
begin
  if to_regclass('public.avisos_destinatarios') is not null or to_regclass('public.obligaciones_recurrentes') is not null then
    raise exception 'avisos_destinatarios u obligaciones_recurrentes YA EXISTE: no se corre nada.';
  end if;
  if to_regclass('public.revisiones_obligacion_unica') is not null then raise exception 'el índice revisiones_obligacion_unica YA EXISTE.'; end if;
end $$;

create table public.avisos_destinatarios (
  tipo text primary key check (tipo ~ '^[a-z0-9_]+$'),
  nombre text not null,
  destinatarios text[] not null default '{}',     -- mails de las cuentas, o 'claude'
  nota text,
  updated_at timestamptz not null default now()
);
comment on table public.avisos_destinatarios is '[script 153] A-FEAT-1449 — tipo de aviso → a quién va por defecto (los mails los carga JMS desde la app).';
insert into public.avisos_destinatarios (tipo, nombre, destinatarios, nota) values
  ('vencimiento_impuesto', 'Vencimientos de impuestos', '{}', '[script 153] JMS: impuestos van a él (los paga)'),
  ('mail_impuestos', 'Mails de impuestos', '{}', '[script 153] JMS: «eso me iría a mí porque tengo que pagar ese impuesto»'),
  ('mail_contador', 'Mails de los contadores', '{}', '[script 153]'),
  ('mail_banco', 'Mails de los bancos', '{}', '[script 153]'),
  ('mail_legal', 'Mails legales / sucesión', '{}', '[script 153]'),
  ('mail_productivo', 'Mails del productivo', '{}', '[script 153]'),
  ('facturas_sin_vincular', 'Facturas históricas sin vincular', '{}', '[script 153] JMS: Ulises, su tarea principal (A-FEAT-1451)'),
  ('subdiarios', 'Presentar los Subdiarios', '{}', '[script 153] JMS: Ulises, los 10 de cada mes'),
  ('extractos_sin_mail', 'Extractos de MSA que no llegan por mail', '{}', '[script 153] JMS: Ulises'),
  ('claude', 'Para Claude (lecturas mal hechas, bugs, mejoras)', '{claude}', '[script 153]');

create table public.obligaciones_recurrentes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  aviso_tipo text not null references public.avisos_destinatarios(tipo) on update cascade,
  dia_mes int not null check (dia_mes between 1 and 28),
  activa boolean not null default true,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.obligaciones_recurrentes is '[script 153] A-FEAT-1449 — lo que hay que hacer todos los meses antes de un día: se crea sola la tarea del mes.';
insert into public.obligaciones_recurrentes (nombre, aviso_tipo, dia_mes, nota) values
  ('Presentar los Subdiarios del mes con las facturas vinculadas', 'subdiarios', 10, '[script 153] JMS 31/10: «presentación de Subdiarios los 10 de cada mes con facturas linkeadas»'),
  ('Cargar los extractos de MSA que no llegan por mail', 'extractos_sin_mail', 10, '[script 153] JMS 31/10 — ⚠️ el día 10 es provisorio: confirmar con JMS');

do $$
declare t text;
begin
  foreach t in array array['avisos_destinatarios','obligaciones_recurrentes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy ver_segun_permiso on public.%I for select to authenticated using (public.puede_ver(%L, %L))', t, 'public', t);
    execute format('create policy escribir_segun_permiso on public.%I for all to authenticated using (public.puede_escribir(%L, %L)) with check (public.puede_escribir(%L, %L))', t, 'public', t, 'public', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
      values ('public', t, 'importar.avisos', '[script 153] Quién recibe qué y obligaciones del mes (A-FEAT-1449): se leen con cualquier sesión, se escriben con admin.', false)
      on conflict do nothing;
  end loop;
end $$;

create unique index revisiones_obligacion_unica on public.revisiones (tabla_ref, registro_id) where origen = 'obligacion';

commit;
notify pgrst, 'reload schema';

-- Control (sólo lee)
select (select count(*) from public.avisos_destinatarios) as tipos,             -- 10
       (select count(*) from public.obligaciones_recurrentes) as obligaciones,  -- 2
       (select count(*) from public.recurso_tablas where motivo like '[script 153]%') as en_recursos;  -- 2
