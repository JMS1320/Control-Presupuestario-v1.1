-- [script 323] ESTRUCTURA — la FOTO del presupuesto (A-FEAT-1677 M3; JMS 27/11: «M3 ok» — presupuesto vs ejecutado por mes cerrado).
-- La app guarda sola una foto el primer día que se abre el presupuesto en cada mes (y cuando JMS la congela a mano): los renglones con sus
-- montos por mes y los totales. Con las fotos, al cerrar un mes se compara lo que se presupuestó para ese mes contra lo que pasó.
-- Tabla NUEVA (verificado 27/11: no existía). Aviso previo en ENTRE-DESARROLLADORES.md. RLS como el resto del presupuesto.
-- Deshacer: scripts/323-fotos-del-presupuesto-deshacer.sql
begin;
do $$ begin
  if to_regclass('public.presupuesto_fotos') is not null then raise exception 'public.presupuesto_fotos ya existe: no se corre nada'; end if;
end $$;
create table public.presupuesto_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (empresa in ('MSA','PAM','MA')),
  fecha date not null,                         -- el día de la foto (hora argentina)
  mes text not null,                           -- YYYY-MM: el mes en curso cuando se tomó
  motivo text not null check (motivo in ('automatica','manual')),
  nota text,
  saldo_inicio numeric,                        -- el saldo de inicio del mes en curso al tomarla
  filas jsonb not null default '[]'::jsonb,    -- [{ bloque, clave, nombre, montos: { 'YYYY-MM': n } }]
  totales jsonb not null default '{}'::jsonb,  -- { ingresos, egresos, inversiones, saldo }: cada uno { 'YYYY-MM': n }
  creado_por text,
  created_at timestamptz not null default now()
);
create unique index presupuesto_fotos_una_automatica_por_mes on public.presupuesto_fotos (empresa, mes) where motivo = 'automatica';
alter table public.presupuesto_fotos enable row level security;
create policy ver_segun_permiso on public.presupuesto_fotos for select to authenticated using (puede_ver('public','presupuesto_fotos'));
create policy escribir_segun_permiso on public.presupuesto_fotos for all to authenticated using (puede_escribir('public','presupuesto_fotos')) with check (puede_escribir('public','presupuesto_fotos'));
grant select, insert, update, delete on public.presupuesto_fotos to authenticated, service_role;
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
select 'public', 'presupuesto_fotos', r.recurso, '[script 323] Fotos mensuales del presupuesto (A-FEAT-1677 M3): como presupuesto_config.', r.restringe_lectura
  from public.recurso_tablas r where r.schema_nombre = 'public' and r.tabla = 'presupuesto_config'
   and not exists (select 1 from public.recurso_tablas x where x.schema_nombre = 'public' and x.tabla = 'presupuesto_fotos');
commit;
