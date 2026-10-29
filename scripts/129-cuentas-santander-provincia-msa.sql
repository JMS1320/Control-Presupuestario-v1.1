-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🏦 Script 129 — A-FEAT-1386 (c): BANCO SANTANDER y BANCO PROVINCIA de MSA, cuentas en PESOS — 2 tablas nuevas
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-29: «Las cuentas Santander y pcia creadas por favor. Son de msa» · «Pesos».
-- Su planilla del 30/06/2025 tiene Santander $ 7.204,86 y Provincia $ 15.298,25 y en la app no había dónde ponerlas.
-- MISMA forma que las de script 126 (caja_general + moneda/TC/par/por_cuenta_de), moneda default 'ARS': así el
-- Extracto, la carga a mano y el balance las tratan igual que a las otras cuentas cargadas a mano.
--
-- Escribe: crea las 2 tablas (FRENA si alguna ya existe) + 2 filas en recurso_tablas marcadas '[script 129]'.
-- No toca ninguna tabla ni fila existente. RLS igual que las cajas (puede_ver / puede_escribir, recurso 'extracto').
-- Deshacer: 129-cuentas-santander-provincia-msa-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
declare t text;
begin
  foreach t in array array['msa.santander','msa.provincia'] loop
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
      ('msa', 'santander', 'ARS', 'MSA — Banco Santander (pesos)'),
      ('msa', 'provincia', 'ARS', 'MSA — Banco Provincia (pesos)')
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
    execute format('comment on table %I.%I is %L', r.esq, r.tab, '[script 129] A-FEAT-1386 — ' || r.que || '. Misma forma que las cajas + moneda/TC/par/por_cuenta_de.');
    execute format('create index %I on %I.%I (fecha)', r.tab || '_fecha', r.esq, r.tab);
    execute format('alter table %I.%I enable row level security', r.esq, r.tab);
    execute format('create policy ver_segun_permiso on %I.%I for select to authenticated using (public.puede_ver(%L, %L))', r.esq, r.tab, r.esq, r.tab);
    execute format('create policy escribir_segun_permiso on %I.%I for all to authenticated using (public.puede_escribir(%L, %L)) with check (public.puede_escribir(%L, %L))', r.esq, r.tab, r.esq, r.tab, r.esq, r.tab);
    execute format('revoke all on %I.%I from anon', r.esq, r.tab);
    execute format('grant select, insert, update, delete on %I.%I to authenticated', r.esq, r.tab);
    execute format('grant all on %I.%I to service_role', r.esq, r.tab);
    insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
      values (r.esq, r.tab, 'extracto', '[script 129] ' || r.que || ' (A-FEAT-1386).', false)
      on conflict do nothing;
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee): 7 tablas, vacías, marcadas, con RLS y en recurso_tablas ─────────────────────────────
select c.relnamespace::regnamespace as esquema, c.relname as tabla, c.relrowsecurity as rls,
       obj_description(c.oid) like '[script 129]%' as marcada,
       (select count(*) from public.recurso_tablas rt where rt.schema_nombre = c.relnamespace::regnamespace::text and rt.tabla = c.relname) as en_recursos
from pg_class c
where c.oid in ('msa.santander'::regclass, 'msa.provincia'::regclass);
