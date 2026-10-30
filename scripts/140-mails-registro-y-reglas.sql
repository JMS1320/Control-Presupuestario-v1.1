-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 📬 Script 140 — A-FEAT-1425: REGISTRO de todo lo que pasa por el mail + REGLAS de clasificación — 2 tablas nuevas
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-30 (terminal GAS): «cada mail se registra quedando indexado para posterior referencia y consulta, con
-- link para ir a verlo» · «ok para las 2 tablas y gas».
--
-- public.mails_registro — UNA fila por mensaje (recibido o enviado), la escribe el GAS de la casilla.
--   · agnóstica del CANAL desde el día 1 (canal = 'mail' | 'whatsapp'): WhatsApp entra después como otro alimentador
--     del mismo informe (A-FEAT-123, la «cola agnóstica» del parte diario).
--   · el link a Gmail NO se guarda: sale de casilla + mensaje_id.
--   · tipo / acción salen de la regla que coincidió (regla_id) o se escriben a mano (tipo_manual: § Default del dato
--     real — campo vacío = usá el de la regla; lleno = manda el usuario).
--   · procesado_por / vinculos: lo que hizo el sistema con el mail (buscador de facturas, boletas ARBA…) y con qué
--     registros quedó vinculado — así el buscador consulta primero acá y sólo va a Gmail si no hay registro.
-- public.mails_reglas — de quién viene (y opcionalmente qué dice el asunto) → tipo y qué se hace (guardar / avisar /
--   archivar). Editable desde la app. Las iniciales salen del catálogo del 30/10 (marca '[script 140]' en nota).
--
-- Escribe: crea las 2 tablas (FRENA si alguna ya existe) + 2 filas en recurso_tablas + las reglas iniciales, todo
-- marcado '[script 140]'. No toca ninguna tabla ni fila existente. RLS como el resto (puede_ver / puede_escribir).
-- Deshacer: 140-mails-registro-y-reglas-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.mails_registro') is not null or to_regclass('public.mails_reglas') is not null then
    raise exception 'mails_registro o mails_reglas YA EXISTE: no se corre nada. Avisar antes de seguir.';
  end if;
end $$;

create table public.mails_reglas (
  id uuid primary key default gen_random_uuid(),
  orden int not null default 100,              -- menor = se evalúa antes; la primera que coincide gana
  activa boolean not null default true,
  remitente_patron text not null,              -- email exacto ('x@y.com') o dominio ('@y.com', incluye subdominios)
  asunto_patron text,                          -- opcional: texto que tiene que aparecer en el asunto (sin mayúsculas)
  tipo text not null check (tipo in ('factura','banco','impuestos','contador','productivo','legal','interno',
                                     'servicios','seguros','notificacion','propaganda','otro')),
  accion text not null check (accion in ('guardar','avisar','archivar')),
  avisar_whatsapp boolean not null default false,  -- previsto desde el día 1 (etapa 2: avisos por WhatsApp a José)
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.mails_reglas is '[script 140] A-FEAT-1425 — reglas de clasificación de los mails: remitente (+ asunto) → tipo y acción.';
create index mails_reglas_orden on public.mails_reglas (activa, orden);

create table public.mails_registro (
  id uuid primary key default gen_random_uuid(),
  canal text not null default 'mail' check (canal in ('mail','whatsapp')),
  casilla text not null,                       -- 'sanmanuel.sp@gmail.com'
  mensaje_id text not null,                    -- id del mensaje en Gmail (o del mensaje de WhatsApp)
  hilo_id text,
  sentido text not null check (sentido in ('recibido','enviado')),
  fecha timestamptz not null,
  remitente text,
  remitente_nombre text,
  destinatarios text,
  asunto text,
  extracto text,                               -- primeras líneas del cuerpo
  etiquetas text[],
  adjuntos jsonb,                              -- [{nombre, tipo, bytes}]
  regla_id uuid references public.mails_reglas(id) on delete set null,
  tipo text,                                   -- el de la regla al registrar
  accion text check (accion is null or accion in ('guardar','avisar','archivar')),
  tipo_manual text,                            -- override del usuario (vacío = el de la regla)
  estado text not null default 'registrado' check (estado in ('registrado','procesado','sin_procesar','error','visto')),
  procesado_por text,                          -- 'buscador_facturas' | 'boletas_arba' | 'detalle_pago' | …
  vinculos jsonb,                              -- [{schema, tabla, id, que}] lo que generó el mail
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canal, casilla, mensaje_id)
);
comment on table public.mails_registro is '[script 140] A-FEAT-1425 — registro de todo lo que pasa por el mail (y después WhatsApp), con su clasificación y lo que generó.';
create index mails_registro_fecha on public.mails_registro (casilla, fecha desc);
create index mails_registro_tipo on public.mails_registro (tipo, fecha desc);
create index mails_registro_hilo on public.mails_registro (hilo_id);

do $$
declare t text;
begin
  foreach t in array array['mails_reglas','mails_registro'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy ver_segun_permiso on public.%I for select to authenticated using (public.puede_ver(%L, %L))', t, 'public', t);
    execute format('create policy escribir_segun_permiso on public.%I for all to authenticated using (public.puede_escribir(%L, %L)) with check (public.puede_escribir(%L, %L))', t, 'public', t, 'public', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
      values ('public', t, 'egresos', '[script 140] Registro y reglas de los mails de la casilla (A-FEAT-1425).', false)
      on conflict do nothing;
  end loop;
end $$;

-- ── Reglas iniciales ───────────────────────────────────────────────────────────────────────────────────────────
-- ~70 reglas sacadas del catálogo del 30/10 (90 días de la casilla), marcadas '[script 140]' en `nota`. NO están acá:
-- tienen direcciones de mail de personas (contadores, familia, abogados) y el repo es PÚBLICO. Viven en la carpeta de
-- comunicación: `Mails/140 reglas iniciales - FUERA DE GIT.sql`. Se cargaron el 30/10 en la misma corrida del 140.

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee) ───────────────────────────────────────────────────────────────────────────────────────
select c.relname as tabla, c.relrowsecurity as rls, obj_description(c.oid) like '[script 140]%' as marcada,
       (select count(*) from public.recurso_tablas rt where rt.schema_nombre = 'public' and rt.tabla = c.relname) as en_recursos,
       (select count(*) from public.mails_reglas) as reglas  -- 0 si todavía no se cargaron las iniciales
from pg_class c where c.oid in ('public.mails_registro'::regclass, 'public.mails_reglas'::regclass);
