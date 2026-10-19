-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 84 · Cobros y retenciones recibidas para PAM y MA     A-FEAT-1219 · A-FEAT-24 · A-BUG-1230 · 2026-10-14
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Pedido del usuario 2026-10-14: «a MA y PAM hay que hacerles la solapa de cobros y agregarles la
-- posibilidad de ponerle retenciones recibidas… llevar a PAM y MA al estado de MSA, pero sin venta de
-- hacienda ni liquidaciones de granos».
--
-- DOS cosas, las dos ADITIVAS (no se toca ninguna fila existente):
--   1 · `retenciones_recibidas` en `pam` y `ma`, copia exacta de `msa.retenciones_recibidas`
--       (certificados de Ganancias / IIBB que llegan con el cobro).
--   2 · `comprobante_venta_id` en los 3 extractos que no lo tienen (`public.pam_galicia`,
--       `public.pam_galicia_cc`, `ma.ma_galicia`): es el vínculo «este crédito cobra esta factura».
--       Sin él, asignar un cobro de PAM/MA desde el Extracto FALLA entero (A-BUG-1230) y la solapa
--       Cobros diría «cobrado $0» en todo (A-FEAT-24).
--
-- ❌ NO se replica el circuito de granos ni de hacienda: ventas, ventas_comprobantes, comisión,
--    almacenaje, plazos, hacienda_lineas, correcciones — MSA por diseño (A-FEAT-1219, alcance del usuario).
--
-- Permisos: los mismos que tiene hoy `msa.retenciones_recibidas` (policies de scripts/62:
-- `ver_segun_permiso` / `escribir_segun_permiso`, nada a `anon`). Las columnas nuevas de los
-- extractos heredan los grants y la RLS de su tabla.
--
-- ⚠️ ANTES de correrlo: avisar a Javier en ENTRE-DESARROLLADORES.md (la BD es una sola).
-- Revert: scripts/84-cobros-pam-ma-deshacer.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

-- ── 1 · Certificados de retención en PAM y MA ────────────────────────────────────────────────
-- `like … including all` copia columnas, defaults, checks e índices de la de MSA. Las FK no se
-- copian (y la de MSA apunta a msa.comprobantes_venta): se crean abajo contra la de cada empresa.
create table if not exists pam.retenciones_recibidas (like msa.retenciones_recibidas including all);
create table if not exists ma.retenciones_recibidas  (like msa.retenciones_recibidas including all);

alter table pam.retenciones_recibidas
  add constraint retenciones_recibidas_comprobante_venta_id_fkey
  foreign key (comprobante_venta_id) references pam.comprobantes_venta(id) on delete set null;
alter table ma.retenciones_recibidas
  add constraint retenciones_recibidas_comprobante_venta_id_fkey
  foreign key (comprobante_venta_id) references ma.comprobantes_venta(id) on delete set null;

comment on table pam.retenciones_recibidas is 'A-FEAT-1219 — certificados de retención recibidos (Ganancias / IIBB) por los cobros de PAM. Copia de msa.retenciones_recibidas.';
comment on table ma.retenciones_recibidas  is 'A-FEAT-1219 — certificados de retención recibidos (Ganancias / IIBB) por los cobros de MA. Copia de msa.retenciones_recibidas.';

do $$
declare s text;
begin
  foreach s in array array['pam', 'ma'] loop
    execute format('alter table %I.retenciones_recibidas enable row level security', s);
    execute format('drop policy if exists "ver_segun_permiso" on %I.retenciones_recibidas', s);
    execute format('drop policy if exists "escribir_segun_permiso" on %I.retenciones_recibidas', s);
    execute format('create policy "ver_segun_permiso" on %I.retenciones_recibidas for select to authenticated using (public.puede_ver(%L, %L))', s, s, 'retenciones_recibidas');
    execute format('create policy "escribir_segun_permiso" on %I.retenciones_recibidas for all to authenticated using (public.puede_escribir(%L, %L)) with check (public.puede_escribir(%L, %L))', s, s, 'retenciones_recibidas', s, 'retenciones_recibidas');
    execute format('revoke all on %I.retenciones_recibidas from anon', s);
    execute format('grant select, insert, update, delete on %I.retenciones_recibidas to authenticated', s);
    execute format('grant all on %I.retenciones_recibidas to service_role', s);
  end loop;
end $$;
-- ⚠️ `pam` tiene privilegios por defecto que agregan REFERENCES/TRIGGER/TRUNCATE a `authenticated` (visto al
-- correrlo el 2026-10-14): se sacan para que quede igual que msa.
revoke references, trigger, truncate on pam.retenciones_recibidas from authenticated;

-- Si la de MSA está mapeada a un recurso, las nuevas siguen el mismo criterio (con su empresa).
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo)
select s, 'retenciones_recibidas', replace(rt.recurso, '-msa', '-' || s), 'Igual que msa.retenciones_recibidas (A-FEAT-1219).'
from public.recurso_tablas rt, unnest(array['pam', 'ma']) s
where rt.schema_nombre = 'msa' and rt.tabla = 'retenciones_recibidas'
on conflict do nothing;

-- ── 2 · El vínculo cobro ↔ factura en los extractos de PAM y MA ─────────────────────────────
alter table public.pam_galicia    add column if not exists comprobante_venta_id uuid references pam.comprobantes_venta(id) on delete set null;
alter table public.pam_galicia_cc add column if not exists comprobante_venta_id uuid references pam.comprobantes_venta(id) on delete set null;
alter table ma.ma_galicia         add column if not exists comprobante_venta_id uuid references ma.comprobantes_venta(id)  on delete set null;

comment on column public.pam_galicia.comprobante_venta_id    is 'A-FEAT-24 — el comprobante de venta de PAM que cobra este crédito (espejo de msa_galicia.comprobante_venta_id).';
comment on column public.pam_galicia_cc.comprobante_venta_id is 'A-FEAT-24 — el comprobante de venta de PAM que cobra este crédito (espejo de msa_galicia.comprobante_venta_id).';
comment on column ma.ma_galicia.comprobante_venta_id         is 'A-FEAT-24 — el comprobante de venta de MA que cobra este crédito (espejo de msa_galicia.comprobante_venta_id).';

commit;
notify pgrst, 'reload schema';

-- 🧮 CONTROL, sin escribir datos (las tres tienen que dar lo esperado):
--   select table_schema, count(*) from information_schema.columns
--    where table_name = 'retenciones_recibidas' group by 1;                -- msa = pam = ma
--   select table_schema, table_name from information_schema.columns
--    where column_name = 'comprobante_venta_id' and table_name like '%galicia%' order by 1, 2;  -- 4 filas
--   explain insert into pam.retenciones_recibidas (tipo, monto) values ('iibb', 1);
--   explain update public.pam_galicia set comprobante_venta_id = null where false;
