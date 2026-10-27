-- =====================================================================================
-- 114 · COBRO AGRUPADO — tabla `grupos_cobro` en msa/pam/ma + `comprobantes_venta.grupo_cobro_id` (A-FEAT-167)
-- =====================================================================================
-- OK de JMS 2026-10-27 («de 1 a 5 sí… hacelo vos»; «pueden ser las dos juntas, deben dar lo mismo»).
-- Espejo de `grupos_pago`: varias ventas del MISMO cliente que se cobran juntas, y a diferencia del pago,
-- en VARIOS movimientos (Sáenz Valiente: 2 liquidaciones cobradas en 3 transferencias, cada una paga una
-- cuota de las dos). Cada movimiento queda atado a una venta del grupo (`comprobante_venta_id`, como el
-- pago agrupado ata el suyo al primer ítem) y el detalle del cobro suma el grupo entero.
--
-- Verificado ANTES de correrlo (27/10): ni `grupos_cobro` ni la columna `grupo_cobro_id` existen en
-- ningún schema → el deshacer puede borrarlas sin perder nada previo.
-- RLS igual que `grupos_pago` (puede_ver / puede_escribir), nada a `anon`. Sin fila en `recurso_tablas`
-- (como `grupos_pago` y `comprobantes_venta`).
-- Deshacer: scripts/114-grupos-cobro-deshacer.sql
-- =====================================================================================
begin;

do $$
declare s text;
begin
  foreach s in array array['msa','pam','ma'] loop
    execute format($f$
      create table if not exists %1$I.grupos_cobro (
        id uuid primary key default gen_random_uuid(),
        cuit varchar not null,
        cliente varchar,
        monto_total numeric,
        estado varchar default 'cobrar',
        observaciones text,
        created_at timestamptz default now()
      )$f$, s);
    execute format('comment on table %1$I.grupos_cobro is %2$L', s,
      '[script 114] Cobro agrupado (A-FEAT-167): varias ventas del mismo cliente cobradas juntas, en uno o varios movimientos. Espejo de grupos_pago.');
    execute format('alter table %1$I.grupos_cobro enable row level security', s);
    execute format('drop policy if exists ver_segun_permiso on %1$I.grupos_cobro', s);
    execute format('drop policy if exists escribir_segun_permiso on %1$I.grupos_cobro', s);
    execute format($f$create policy ver_segun_permiso on %1$I.grupos_cobro for select to authenticated
                     using (public.puede_ver(%1$L, 'grupos_cobro'))$f$, s);
    execute format($f$create policy escribir_segun_permiso on %1$I.grupos_cobro for all to authenticated
                     using (public.puede_escribir(%1$L, 'grupos_cobro')) with check (public.puede_escribir(%1$L, 'grupos_cobro'))$f$, s);
    execute format('revoke all on %1$I.grupos_cobro from anon', s);
    execute format('grant select, insert, update, delete on %1$I.grupos_cobro to authenticated, service_role', s);

    execute format('alter table %1$I.comprobantes_venta add column if not exists grupo_cobro_id uuid references %1$I.grupos_cobro(id) on delete set null', s);
    execute format('comment on column %1$I.comprobantes_venta.grupo_cobro_id is %2$L', s,
      '[script 114] Grupo de cobro de la venta (A-FEAT-167). Null = se cobra sola.');
  end loop;
end $$;

-- Control: 3 tablas y 3 columnas.
do $$
declare t int; c int;
begin
  select count(*) into t from information_schema.tables where table_name = 'grupos_cobro' and table_schema in ('msa','pam','ma');
  select count(*) into c from information_schema.columns where table_name = 'comprobantes_venta' and column_name = 'grupo_cobro_id' and table_schema in ('msa','pam','ma');
  if t <> 3 or c <> 3 then raise exception '114: esperaba 3 tablas y 3 columnas, hay % y %', t, c; end if;
end $$;

commit;
