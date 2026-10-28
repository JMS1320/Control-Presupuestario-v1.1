-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🌾 Script 121 — A-FEAT-1397 etapa 2: SUB-LOTES y los LOTES DE CADA ORDEN agrícola
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Nota de JMS 2026-10-28 (Órdenes Aplicación → Agrícola): «a medida que vaya midiendo lotes individuales —ER1, ER2,
-- ER3— poder ir registrándolo… que pueda estar comprendido dentro de uno más grande. ER1 dentro de ER 1,2,3».
-- OK de JMS a la etapa 2 el 28/10.
--
-- 1) productivo.lotes_agricolas.lote_padre_id — un lote puede estar DENTRO de otro (ER1 dentro de «Entre Rios 1, 2, 3»).
--    Las hectáreas del lote madre quedan como están (las cargadas); la pantalla muestra «medido X de Y ha» con la suma
--    de los hijos.
-- 2) productivo.ordenes_agricolas_lotes — cada lote de la orden con SUS hectáreas. Hasta hoy la orden guardaba sólo el
--    texto «Casas / Tropilla Parque» y el total (lote_id vacío en las 16): no se sabía cuánto fue a cada lote y al
--    editarla los juntaba en una fila. Mismo patrón que ordenes_aplicacion_rodeos de la orden ganadera.
--    ordenes_agricolas.lote_nombre se sigue escribiendo (el PNG y Hacienda al cierre lo leen).
-- 3) Carga de las órdenes existentes: se parte el texto por « / », cada nombre se ata al lote de ese nombre (si hay
--    dos con el mismo nombre —Ribera Abajo—, al más viejo) y las hectáreas son las del lote; si no suman el total de
--    la orden, se reparten en proporción y el redondeo va al lote más grande, para que la suma dé el total.
--
-- Escribe: 1 columna nueva, 1 tabla nueva, 1 fila en recurso_tablas, y las filas de la tabla nueva. No modifica
-- ninguna orden ni ningún lote existente.
-- Deshacer: 121-sublotes-y-lotes-de-orden-deshacer.sql — sólo borra lo que este script crea (el script frena si la
-- columna o la tabla ya existían). Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('productivo.ordenes_agricolas_lotes') is not null then
    raise exception 'productivo.ordenes_agricolas_lotes YA EXISTE: no se corre. Avisar antes de seguir.';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'productivo' and table_name = 'lotes_agricolas' and column_name = 'lote_padre_id') then
    raise exception 'productivo.lotes_agricolas.lote_padre_id YA EXISTE: no se corre. Avisar antes de seguir.';
  end if;
end $$;

-- 1) Sub-lotes
alter table productivo.lotes_agricolas
  add column lote_padre_id uuid references productivo.lotes_agricolas(id) on delete set null;
alter table productivo.lotes_agricolas
  add constraint lotes_agricolas_padre_distinto check (lote_padre_id is null or lote_padre_id <> id);
comment on column productivo.lotes_agricolas.lote_padre_id is
  '[script 121] A-FEAT-1397 — el lote madre que lo contiene (ER1 dentro de «Entre Rios 1, 2, 3»). Vacío = lote suelto.';

-- 2) Los lotes de cada orden
create table productivo.ordenes_agricolas_lotes (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references productivo.ordenes_agricolas(id) on delete cascade,
  lote_id uuid references productivo.lotes_agricolas(id) on delete set null,  -- vacío = lote escrito a mano
  lote_nombre text not null,
  hectareas numeric not null default 0,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
comment on table productivo.ordenes_agricolas_lotes is
  '[script 121] A-FEAT-1397 — cada lote de una orden agrícola con sus hectáreas. La suma es ordenes_agricolas.hectareas.';
create index ordenes_agricolas_lotes_orden on productivo.ordenes_agricolas_lotes (orden_id);
create index ordenes_agricolas_lotes_lote on productivo.ordenes_agricolas_lotes (lote_id);

alter table productivo.ordenes_agricolas_lotes enable row level security;
create policy ver_segun_permiso on productivo.ordenes_agricolas_lotes for select to authenticated
  using (public.puede_ver('productivo', 'ordenes_agricolas_lotes'));
create policy escribir_segun_permiso on productivo.ordenes_agricolas_lotes for all to authenticated
  using (public.puede_escribir('productivo', 'ordenes_agricolas_lotes'))
  with check (public.puede_escribir('productivo', 'ordenes_agricolas_lotes'));
revoke all on productivo.ordenes_agricolas_lotes from anon;
grant select, insert, update, delete on productivo.ordenes_agricolas_lotes to authenticated;
grant all on productivo.ordenes_agricolas_lotes to service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('productivo', 'ordenes_agricolas_lotes', 'productivo',
   '[script 121] Lotes de cada orden agrícola con sus hectáreas (A-FEAT-1397). Mismo recurso que ordenes_agricolas.', false);

-- 3) Las órdenes existentes
with partes as (
  select o.id as orden_id, o.hectareas as ha_orden, trim(p.nombre) as nombre, p.pos::int as pos
  from productivo.ordenes_agricolas o
  cross join lateral unnest(string_to_array(o.lote_nombre, ' / ')) with ordinality as p(nombre, pos)
  where coalesce(trim(o.lote_nombre), '') <> ''
),
lote_por_nombre as (
  select distinct on (nombre_lote) nombre_lote, id, hectareas
  from productivo.lotes_agricolas order by nombre_lote, created_at
),
base as (
  select pa.orden_id, pa.ha_orden, pa.nombre, pa.pos, l.id as lote_id,
         coalesce(l.hectareas, 0) as ha_lote,
         sum(coalesce(l.hectareas, 0)) over (partition by pa.orden_id) as ha_lotes,
         count(*) over (partition by pa.orden_id) as n
  from partes pa left join lote_por_nombre l on l.nombre_lote = pa.nombre
),
prop as (
  select *, case when ha_lotes > 0 then round(ha_orden * ha_lote / ha_lotes, 2) else round(ha_orden / n, 2) end as ha,
         row_number() over (partition by orden_id order by ha_lote desc, pos) as rk
  from base
),
cierre as (
  select *, ha_orden - sum(ha) over (partition by orden_id) as resto from prop
)
insert into productivo.ordenes_agricolas_lotes (orden_id, lote_id, lote_nombre, hectareas, orden)
select orden_id, lote_id, nombre, ha + case when rk = 1 then resto else 0 end, pos
from cierre;

-- Control: por cada orden, la suma de sus lotes = el total de la orden
do $$
declare v_mal int; v_filas int;
begin
  select count(*) into v_mal from productivo.ordenes_agricolas o
  where coalesce(trim(o.lote_nombre), '') <> ''
    and o.hectareas is distinct from (select sum(hectareas) from productivo.ordenes_agricolas_lotes x where x.orden_id = o.id);
  select count(*) into v_filas from productivo.ordenes_agricolas_lotes;
  if v_mal > 0 then raise exception 'Control: % órdenes no cierran sus hectáreas. No se aplica nada.', v_mal; end if;
  raise notice 'OK: % lotes de orden cargados; todas las órdenes cierran sus hectáreas.', v_filas;
end $$;

commit;
