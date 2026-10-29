-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 💵 Script 126 — A-FEAT-1398: LAS CUENTAS EN DÓLARES Y LAS DE COTITULARES — 7 tablas nuevas
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-28: «MSA tiene cta cte y caja física en dólares… MA tiene CA y física… cotit: dólares CA, pesos CA y
-- física dólares». «Cotitulares» = MA, Manuel, Soledad, Mechi, Andrés y JMS (titular propio, aparte de MSA/PAM/MA).
--
-- Cada cuenta es una tabla con la MISMA forma que las cajas (msa.caja_general), para que el Extracto, la conciliación
-- y la propagación de la cuenta contable las traten igual. Se suman 6 columnas propias:
--   · moneda          'USD' | 'ARS' — la de la cuenta (débitos/créditos/saldo van en ESA moneda)
--   · tipo_cambio     pesos por dólar del movimiento (sólo en las de USD; vacío = sin dato todavía)
--   · importe_pesos   el equivalente en pesos (default = importe × TC; se puede escribir a mano)
--   · par_schema/par_tabla/par_id   el otro movimiento de una compra/venta de dólares (sale USD, entran pesos)
--   · por_cuenta_de   'MSA' | 'PAM' | 'MA' — la plata de Cotitulares que pagó algo de una empresa: arma la
--                     cuenta corriente Cotitulares ↔ esa empresa (préstamo o aporte: lo decide JMS)
--
-- Escribe: crea las 7 tablas (FRENA si alguna ya existe) + 7 filas en recurso_tablas marcadas '[script 126]'.
-- No toca ninguna tabla ni fila existente. RLS igual que las cajas (puede_ver / puede_escribir, recurso 'extracto').
-- Deshacer: 126-cuentas-dolares-cotitulares-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
declare t text;
begin
  foreach t in array array['msa.cc_usd','msa.caja_usd','ma.ca_usd','ma.caja_usd',
                           'public.cotitulares_ca_usd','public.cotitulares_ca_pesos','public.cotitulares_caja_usd'] loop
    if to_regclass(t) is not null then
      raise exception '% YA EXISTE: no se corre nada. Avisar antes de seguir.', t;
    end if;
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('msa',    'cc_usd',               'USD', 'MSA — cuenta corriente en dólares'),
      ('msa',    'caja_usd',             'USD', 'MSA — caja física en dólares'),
      ('ma',     'ca_usd',               'USD', 'MA — caja de ahorro en dólares'),
      ('ma',     'caja_usd',             'USD', 'MA — caja física en dólares'),
      ('public', 'cotitulares_ca_usd',   'USD', 'Cotitulares — caja de ahorro en dólares'),
      ('public', 'cotitulares_ca_pesos', 'ARS', 'Cotitulares — caja de ahorro en pesos'),
      ('public', 'cotitulares_caja_usd', 'USD', 'Cotitulares — caja física en dólares')
    ) as v(esq, tab, mon, que)
  loop
    execute format($f$
      create table %1$I.%2$I (
        id uuid primary key default gen_random_uuid(),
        fecha date,
        descripcion text,
        debitos numeric,
        creditos numeric,
        saldo numeric,
        control numeric,
        categ text,
        detalle text,
        contable text,
        interno text,
        centro_de_costo text,
        cuenta text,
        orden numeric,
        estado text not null default 'Pendiente',
        motivo_revision text,
        comprobante_arca_id uuid,
        nro_cuenta varchar,
        template_id uuid,
        template_cuota_id uuid,
        moneda text not null default %3$L check (moneda in ('USD','ARS')),
        tipo_cambio numeric check (tipo_cambio is null or tipo_cambio > 0),
        importe_pesos numeric,
        par_schema text,
        par_tabla text,
        par_id uuid,
        por_cuenta_de text check (por_cuenta_de is null or por_cuenta_de in ('MSA','PAM','MA')),
        created_at timestamptz not null default now()
      )$f$, r.esq, r.tab, r.mon);
    execute format('comment on table %I.%I is %L', r.esq, r.tab, '[script 126] A-FEAT-1398 — ' || r.que || '. Misma forma que las cajas + moneda/TC/par/por_cuenta_de.');
    execute format('create index %I on %I.%I (fecha)', r.tab || '_fecha', r.esq, r.tab);
    execute format('alter table %I.%I enable row level security', r.esq, r.tab);
    execute format('create policy ver_segun_permiso on %I.%I for select to authenticated using (public.puede_ver(%L, %L))', r.esq, r.tab, r.esq, r.tab);
    execute format('create policy escribir_segun_permiso on %I.%I for all to authenticated using (public.puede_escribir(%L, %L)) with check (public.puede_escribir(%L, %L))', r.esq, r.tab, r.esq, r.tab, r.esq, r.tab);
    execute format('revoke all on %I.%I from anon', r.esq, r.tab);
    execute format('grant select, insert, update, delete on %I.%I to authenticated', r.esq, r.tab);
    execute format('grant all on %I.%I to service_role', r.esq, r.tab);
    insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
      values (r.esq, r.tab, 'extracto', '[script 126] ' || r.que || ' (A-FEAT-1398).', false)
      on conflict do nothing;
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee): 7 tablas, vacías, marcadas, con RLS y en recurso_tablas ─────────────────────────────
select c.relnamespace::regnamespace as esquema, c.relname as tabla, c.relrowsecurity as rls,
       obj_description(c.oid) like '[script 126]%' as marcada,
       (select count(*) from public.recurso_tablas rt where rt.schema_nombre = c.relnamespace::regnamespace::text and rt.tabla = c.relname) as en_recursos
from pg_class c
where c.oid in ('msa.cc_usd'::regclass, 'msa.caja_usd'::regclass, 'ma.ca_usd'::regclass, 'ma.caja_usd'::regclass,
                'public.cotitulares_ca_usd'::regclass, 'public.cotitulares_ca_pesos'::regclass, 'public.cotitulares_caja_usd'::regclass);
