-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🌾 Script 131 — A-FEAT-1420: STOCK DECLARADO AL INICIO + PASTURAS — 2 tablas nuevas en productivo
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-29: «hay stock de rollos, de silo de maíz, pasturas con cantidad de años de antigüedad. Tomá todo lo
-- que pongo como un dato… al 17/2 es un punto de partida; esto es básicamente stock al 30/6 que no afecta, pero sí
-- habrá que crear varios insumos». Y: «tenés siempre dos registros, el que fue al contador y el que registré yo…
-- andá dejando registrado de dónde tomaste cada dato».
--
-- · productivo.stock_inicio — el stock DECLARADO a una fecha (inicio de ejercicio), producto por producto, en sus
--   unidades. NO es un movimiento: la existencia de la app sigue saliendo de movimientos_insumos (desde el 17/02/2026).
--   `version` = 'jms' (registro interno) o 'contador' (lo que fue al contador); `fuente` = archivo, hoja, fila.
-- · productivo.pasturas — las pasturas permanentes por año de siembra (lote, ha, US$/ha) con su vida útil para la
--   amortización (25 % por año = 4 años) y la baja si se perdió.
--
-- Escribe: crea las 2 tablas (FRENA si alguna ya existe) + 2 filas en recurso_tablas marcadas '[script 131]'.
-- No toca ninguna tabla ni fila existente. RLS igual que el resto de productivo (puede_ver / puede_escribir).
-- Deshacer: 131-stock-inicio-y-pasturas-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('productivo.stock_inicio') is not null or to_regclass('productivo.pasturas') is not null then
    raise exception 'productivo.stock_inicio o productivo.pasturas YA EXISTE: no se corre nada. Avisar antes de seguir.';
  end if;
end $$;

create table productivo.stock_inicio (
  id uuid primary key default gen_random_uuid(),
  empresa text not null default 'MSA' check (empresa in ('MSA','PAM','MA')),
  fecha date not null,
  version text not null default 'jms' check (version in ('jms','contador')),
  -- el producto de la app (null = todavía sin emparejar)
  insumo_stock_id uuid references productivo.stock_insumos(id),
  rubro text not null check (rubro in ('insumo','forraje','combustible')),
  -- tal cual lo escribió el usuario en su planilla
  producto_planilla text not null,
  categoria_planilla text,
  cantidad numeric,
  unidad text,
  precio_unitario numeric,
  moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
  tipo_cambio numeric check (tipo_cambio is null or tipo_cambio > 0),
  -- el valor en pesos tal cual la planilla (o cantidad × precio × TC si no lo trae)
  valor_pesos numeric,
  emparejado text check (emparejado is null or emparejado in ('mismo','a confirmar','nuevo')),
  fuente text not null,
  nota text,
  created_at timestamptz not null default now()
);
comment on table productivo.stock_inicio is '[script 131] A-FEAT-1420 — stock DECLARADO a una fecha (inicio de ejercicio) por producto, en sus unidades; no es un movimiento.';
create index stock_inicio_fecha on productivo.stock_inicio (empresa, fecha);

create table productivo.pasturas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null default 'MSA' check (empresa in ('MSA','PAM','MA')),
  lotes text not null,
  anio_siembra int not null,
  hectareas numeric not null,
  usd_por_ha numeric,
  -- 4 años = 25 % por año (así lo amortiza JMS en el BAPU)
  vida_util_anios int not null default 4,
  -- si se perdió: desde ahí vale 0
  baja_fecha date,
  baja_motivo text,
  fuente text not null,
  nota text,
  created_at timestamptz not null default now()
);
comment on table productivo.pasturas is '[script 131] A-FEAT-1420 — pasturas permanentes por año de siembra; amortización por antigüedad.';

do $$
declare t text;
begin
  foreach t in array array['stock_inicio','pasturas'] loop
    execute format('alter table productivo.%I enable row level security', t);
    execute format('create policy ver_segun_permiso on productivo.%I for select to authenticated using (public.puede_ver(%L, %L))', t, 'productivo', t);
    execute format('create policy escribir_segun_permiso on productivo.%I for all to authenticated using (public.puede_escribir(%L, %L)) with check (public.puede_escribir(%L, %L))', t, 'productivo', t, 'productivo', t);
    execute format('revoke all on productivo.%I from anon', t);
    execute format('grant select, insert, update, delete on productivo.%I to authenticated', t);
    execute format('grant all on productivo.%I to service_role', t);
    insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
      values ('productivo', t, 'productivo', '[script 131] ' || t || ' (A-FEAT-1420).', false)
      on conflict do nothing;
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee) ──────────────────────────────────────────────────────────────────────────────────────
select c.relname as tabla, c.relrowsecurity as rls, obj_description(c.oid) like '[script 131]%' as marcada,
       (select count(*) from public.recurso_tablas rt where rt.schema_nombre = 'productivo' and rt.tabla = c.relname) as en_recursos
from pg_class c where c.oid in ('productivo.stock_inicio'::regclass, 'productivo.pasturas'::regclass);
