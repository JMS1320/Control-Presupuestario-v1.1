-- [script 322] ESTRUCTURA — las VENTAS PARCIALES PRESUPUESTADAS de un lote (A-FEAT-1675; JMS 27/11: «dividir la venta presupuestada de novillos y
-- vaquillonas de feed lot en 2 ventas… luego puedo convertirlo en una venta firme editando los datos reales» · «dale, avanzá… y poder accionarlo
-- también desde presupuesto»).
-- Un lote tiene su venta principal (stock_lotes.fecha_venta_estimada, para lo que quede) y, además, N ventas parciales presupuestadas, cada una con
-- su fecha y cabezas (peso / precio / plazo opcionales: vacío = los del lote). Al confirmarla con los datos reales, `venta_id` la ata a la venta firme
-- (productivo.stock_ventas) y deja de proyectarse. Tabla NUEVA (verificado 27/11: no existía). Aviso previo en ENTRE-DESARROLLADORES.md.
-- RLS como el resto de productivo (puede_ver / puede_escribir) y mapeo en recurso_tablas al recurso «productivo».
-- Deshacer: scripts/322-ventas-parciales-del-lote-deshacer.sql
begin;
do $$ begin
  if to_regclass('productivo.lote_ventas_plan') is not null then raise exception 'productivo.lote_ventas_plan ya existe: no se corre nada'; end if;
end $$;
create table productivo.lote_ventas_plan (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references productivo.stock_lotes(id) on delete cascade,
  fecha_venta date not null,
  cabezas numeric not null check (cabezas > 0),
  peso_kg numeric,
  precio_kg numeric,
  plazo_cobro text,
  venta_id uuid references productivo.stock_ventas(id) on delete set null,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lote_ventas_plan_lote on productivo.lote_ventas_plan (lote_id);
alter table productivo.lote_ventas_plan enable row level security;
create policy ver_segun_permiso on productivo.lote_ventas_plan for select to authenticated using (puede_ver('productivo','lote_ventas_plan'));
create policy escribir_segun_permiso on productivo.lote_ventas_plan for all to authenticated using (puede_escribir('productivo','lote_ventas_plan')) with check (puede_escribir('productivo','lote_ventas_plan'));
grant select, insert, update, delete on productivo.lote_ventas_plan to authenticated, service_role;
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
select 'productivo', 'lote_ventas_plan', 'productivo', '[script 322] Ventas parciales presupuestadas de un lote (A-FEAT-1675): como stock_lotes.', false
 where not exists (select 1 from public.recurso_tablas where schema_nombre = 'productivo' and tabla = 'lote_ventas_plan');
commit;
