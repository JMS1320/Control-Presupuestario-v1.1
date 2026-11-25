-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 296 · A-FEAT-1660 etapa 2 — las MARCAS del presupuesto: «dado por pagado / cobrado» sin tocar el dato
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 25/11: «un checkbox mensual para decir que está todo pago y en los detalles poder seleccionar las que sí
-- están impagas y accionar que el resto se ponga como pago… la parte de los pagos por un lado y la de los cobros
-- por el otro… incluyendo noviembre». P1 (a): se guarda como SUPUESTO DEL PRESUPUESTO, en una capa aparte —
-- la factura, la cuota o el sueldo NO cambian. Cuando se concilia, manda el dato real.
--
-- Una fila por renglón real marcado (el `id` y la `origen_tabla` del Cash Flow). `marca`:
--   pagado · cobrado · impago (confirmado: «éste sí está impago») · no_concretado (cobro que no se fijó)
-- Huella (§ TODO SE FECHA): cuándo y quién, y el monto/detalle/fecha que tenía al marcarlo.
-- Tabla nueva y aislada; RLS como las demás del presupuesto. Deshacer: 296-…-deshacer.sql
-- ════════════════════════════════════════════════════════════════════════════════════════════
create table public.presupuesto_marcas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null default 'MSA',
  origen_tabla text not null,
  fila_id text not null,
  origen text,
  marca text not null check (marca in ('pagado', 'cobrado', 'impago', 'no_concretado')),
  fecha_fila date,
  monto numeric(16,2),
  detalle text,
  marcado_at timestamptz not null default now(),
  marcado_por text,
  unique (empresa, origen_tabla, fila_id)
);
comment on table public.presupuesto_marcas is 'A-FEAT-1660 (script 296): supuestos del presupuesto — renglones dados por pagados/cobrados sin conciliar. No cambia el dato real.';
alter table public.presupuesto_marcas enable row level security;
create policy ver_segun_permiso on public.presupuesto_marcas for select to authenticated using (public.puede_ver('public', 'presupuesto_marcas'));
create policy escribir_segun_permiso on public.presupuesto_marcas for all to authenticated
  using (public.puede_escribir('public', 'presupuesto_marcas')) with check (public.puede_escribir('public', 'presupuesto_marcas'));
revoke all on public.presupuesto_marcas from anon;
grant select, insert, update, delete on public.presupuesto_marcas to authenticated;
grant all on public.presupuesto_marcas to service_role;
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
  values ('public', 'presupuesto_marcas', 'presupuesto', '[script 296] Marcas del presupuesto: dado por pagado/cobrado (A-FEAT-1660).', false)
  on conflict do nothing;
