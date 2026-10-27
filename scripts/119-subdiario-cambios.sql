-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔁 Script 119 — A-FEAT-1394: un mes ENVIADO o PRESENTADO que cambia queda «A RECTIFICAR»
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Pedido de JMS 2026-10-27: «sería bueno que la app registre que si se le cambió dato debe pedir rectificar» — y el
-- criterio: si el cambio NO modifica IVA, se rectifica sólo el subdiario; si lo modifica, también la DDJJ.
--
-- 1) Tabla public.subdiario_cambios: un renglón por cambio a un comprobante de un mes «Enviado» o «DDJJ OK», con el
--    antes y el después de los datos fiscales, si cambia el IVA, y cuándo se dio por rectificado.
-- 2) Un TRIGGER en compras y ventas de MSA, PAM y MA que lo registra solo — cualquier camino (pantalla, script,
--    importación) queda anotado. Sólo mira datos fiscales: tipo, punto de venta, número, CUIT, fecha, importes,
--    tipo de cambio y el mes del subdiario. Un cambio de estado de pago, de cuenta o de la marca DDJJ NO cuenta.
-- 3) Los dos primeros casos, cargados a mano: las NC de Federación de enero y abril que JMS pasó a negativo el 27/10
--    ~13:00, antes de que existiera el registro (los valores de antes salen de la foto del 27/10 12:26).
--
-- Escribe: crea la tabla, la función y los triggers; 1 fila en recurso_tablas; 2 filas en la tabla nueva.
-- No toca ningún comprobante. Deshacer: 119-subdiario-cambios-deshacer.sql (borra sólo lo que tiene la marca).
-- Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.subdiario_cambios') is not null then
    raise exception 'public.subdiario_cambios YA EXISTE: no se corre. Avisar antes de seguir.';
  end if;
end $$;

create table public.subdiario_cambios (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (empresa in ('MSA', 'PAM', 'MA')),
  lado text not null check (lado in ('compras', 'ventas')),
  anio int not null,
  mes int not null check (mes between 1 and 12),
  comprobante_id uuid not null,
  accion text not null check (accion in ('modificado', 'salio', 'entro', 'borrado')),
  estado_mes text,                                   -- el estado DDJJ del comprobante (o del mes) cuando cambió
  antes jsonb,                                       -- los datos fiscales antes del cambio
  despues jsonb,                                     -- y después
  modifica_iva boolean not null default false,       -- si el cambio mueve el IVA del mes
  quien text,
  creado_at timestamptz not null default now(),
  rectificado_at timestamptz,                        -- cuando se dio por rectificado (se mandó el subdiario rectificado)
  rectificado_por text,
  rectificado_nota text
);
comment on table public.subdiario_cambios is
  '[script 119] A-FEAT-1394 — cambios a comprobantes de un mes Enviado o DDJJ OK: el mes queda A RECTIFICAR (sólo el subdiario si no modifica IVA; también la DDJJ si lo modifica) hasta que se marca rectificado. Lo llena el trigger registrar_cambio_subdiario.';
create index subdiario_cambios_abiertos on public.subdiario_cambios (empresa, lado, anio, mes) where rectificado_at is null;

alter table public.subdiario_cambios enable row level security;
create policy ver_segun_permiso on public.subdiario_cambios for select to authenticated
  using (public.puede_ver('public', 'subdiario_cambios'));
create policy escribir_segun_permiso on public.subdiario_cambios for update to authenticated
  using (public.puede_escribir('public', 'subdiario_cambios')) with check (public.puede_escribir('public', 'subdiario_cambios'));
revoke all on public.subdiario_cambios from anon;
grant select, update on public.subdiario_cambios to authenticated;
grant all on public.subdiario_cambios to service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('public', 'subdiario_cambios', 'egresos', '[script 119] Cambios a meses enviados o presentados: a rectificar (A-FEAT-1394).', false)
on conflict do nothing;

-- ── El registro automático ────────────────────────────────────────────────────────────────────────────────────
create function public.registrar_cambio_subdiario() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_empresa text := upper(tg_table_schema);
  v_lado text := case when tg_table_name = 'comprobantes_venta' then 'ventas' else 'compras' end;
  claves text[] := array['tipo_comprobante', 'punto_venta', 'numero_desde', 'cuit', 'cuit_cliente', 'fecha_emision',
    'fecha_liquidacion', 'imp_neto_gravado', 'imp_neto_no_gravado', 'imp_op_exentas', 'otros_tributos', 'iva', 'imp_total',
    'tipo_cambio', 'año_contable', 'mes_contable'];
  o jsonb; nw jsonb; v_old jsonb; v_new jsonb;
  v_quien text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', current_user);
  iva_old numeric := 0; iva_new numeric := 0;
  mes_nuevo_protegido boolean := false;
  cambio_mes boolean := false;
  protegido constant text[] := array['Enviado', 'DDJJ OK'];
begin
  if tg_op in ('UPDATE', 'DELETE') then
    o := to_jsonb(old);
    select jsonb_object_agg(k, o -> k) into v_old from unnest(claves) k where o ? k;
    iva_old := coalesce((o ->> 'iva')::numeric, 0) * coalesce(nullif((o ->> 'tipo_cambio')::numeric, 0), 1);
  end if;
  if tg_op in ('UPDATE', 'INSERT') then
    nw := to_jsonb(new);
    select jsonb_object_agg(k, nw -> k) into v_new from unnest(claves) k where nw ? k;
    iva_new := coalesce((nw ->> 'iva')::numeric, 0) * coalesce(nullif((nw ->> 'tipo_cambio')::numeric, 0), 1);
    if (nw ->> 'año_contable') is not null and (nw ->> 'mes_contable') is not null then
      execute format('select exists (select 1 from %I.%I where "año_contable" = $1 and mes_contable = $2 and ddjj_iva = any ($3) and id <> $4)',
        tg_table_schema, tg_table_name)
        into mes_nuevo_protegido using (nw ->> 'año_contable')::int, (nw ->> 'mes_contable')::int, protegido, (nw ->> 'id')::uuid;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if v_old is not distinct from v_new then return null; end if;
    cambio_mes := (o ->> 'año_contable', o ->> 'mes_contable') is distinct from (nw ->> 'año_contable', nw ->> 'mes_contable');
    if (o ->> 'ddjj_iva') = any (protegido) and (o ->> 'año_contable') is not null and (o ->> 'mes_contable') is not null then
      insert into public.subdiario_cambios (empresa, lado, anio, mes, comprobante_id, accion, estado_mes, antes, despues, modifica_iva, quien)
      values (v_empresa, v_lado, (o ->> 'año_contable')::int, (o ->> 'mes_contable')::int, (o ->> 'id')::uuid,
        case when cambio_mes then 'salio' else 'modificado' end, o ->> 'ddjj_iva', v_old, v_new,
        case when cambio_mes then iva_old <> 0 else iva_old is distinct from iva_new end, v_quien);
    end if;
    if cambio_mes and mes_nuevo_protegido then
      insert into public.subdiario_cambios (empresa, lado, anio, mes, comprobante_id, accion, estado_mes, antes, despues, modifica_iva, quien)
      values (v_empresa, v_lado, (nw ->> 'año_contable')::int, (nw ->> 'mes_contable')::int, (nw ->> 'id')::uuid,
        'entro', nw ->> 'ddjj_iva', v_old, v_new, iva_new <> 0, v_quien);
    end if;
  elsif tg_op = 'INSERT' then
    if mes_nuevo_protegido then
      insert into public.subdiario_cambios (empresa, lado, anio, mes, comprobante_id, accion, estado_mes, antes, despues, modifica_iva, quien)
      values (v_empresa, v_lado, (nw ->> 'año_contable')::int, (nw ->> 'mes_contable')::int, (nw ->> 'id')::uuid,
        'entro', nw ->> 'ddjj_iva', null, v_new, iva_new <> 0, v_quien);
    end if;
  elsif tg_op = 'DELETE' then
    if (o ->> 'ddjj_iva') = any (protegido) and (o ->> 'año_contable') is not null and (o ->> 'mes_contable') is not null then
      insert into public.subdiario_cambios (empresa, lado, anio, mes, comprobante_id, accion, estado_mes, antes, despues, modifica_iva, quien)
      values (v_empresa, v_lado, (o ->> 'año_contable')::int, (o ->> 'mes_contable')::int, (o ->> 'id')::uuid,
        'borrado', o ->> 'ddjj_iva', v_old, null, iva_old <> 0, v_quien);
    end if;
  end if;
  return null;
end
$fn$;
comment on function public.registrar_cambio_subdiario() is '[script 119] A-FEAT-1394 — anota en subdiario_cambios los cambios fiscales a un mes Enviado o DDJJ OK.';

do $$
declare t text;
begin
  foreach t in array array['msa.comprobantes_arca', 'pam.comprobantes_arca', 'ma.comprobantes_arca',
                           'msa.comprobantes_venta', 'pam.comprobantes_venta', 'ma.comprobantes_venta'] loop
    if to_regclass(t) is null then
      raise notice '% no existe: sin trigger.', t;
      continue;
    end if;
    execute format('create trigger trg_registrar_cambio_subdiario after insert or update or delete on %s for each row execute function public.registrar_cambio_subdiario()', t);
    execute format('comment on trigger trg_registrar_cambio_subdiario on %s is %L', t, '[script 119] A-FEAT-1394');
  end loop;
end $$;

-- ── Los dos primeros casos: las NC de Federación (cambio de JMS del 27/10, antes del registro) ─────────────────
insert into public.subdiario_cambios (empresa, lado, anio, mes, comprobante_id, accion, estado_mes, antes, despues, modifica_iva, quien)
values
  ('MSA', 'compras', 2026, 1, 'ff8674bb-03ea-4455-89b0-8488002ea7c0', 'modificado', 'Imputado',
   '{"tipo_comprobante": 1, "punto_venta": 1, "numero_desde": 670822, "imp_op_exentas": 47198.41, "otros_tributos": 283.19, "iva": 0, "imp_total": 47481.60}',
   '{"tipo_comprobante": 1, "punto_venta": 1, "numero_desde": 670822, "imp_op_exentas": -47198.41, "otros_tributos": -283.19, "iva": 0, "imp_total": -47481.60}',
   false, '[script 119] cargado a mano: JMS pasó la NC de Federación a negativo el 27/10 ~13:00 (antes del registro). Enero se presentó aunque figura «Imputado».'),
  ('MSA', 'compras', 2026, 4, 'e397575b-8290-4384-950b-f318a0dd3e75', 'modificado', 'DDJJ OK',
   '{"tipo_comprobante": 1, "punto_venta": 4, "numero_desde": 670821, "imp_op_exentas": 81676.64, "otros_tributos": 490.06, "iva": 0, "imp_total": 82166.70}',
   '{"tipo_comprobante": 1, "punto_venta": 4, "numero_desde": 670821, "imp_op_exentas": -81676.64, "otros_tributos": -490.06, "iva": 0, "imp_total": -82166.70}',
   false, '[script 119] cargado a mano: JMS pasó la NC de Federación a negativo el 27/10 ~13:00 (antes del registro).');

commit;
notify pgrst, 'reload schema';
