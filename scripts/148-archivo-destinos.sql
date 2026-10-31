-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🗂️ Script 148 — A-FEAT-1442: DÓNDE SE ARCHIVA cada tipo de documento — tabla nueva `public.archivo_destinos`
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-31 (terminal GAS, camino 2): «ok, creá la tabla y arrancá la tanda 4».
--
-- Una fila por tipo de documento («ARBA Inmobiliario», después Red Vial, ABL, expensas…). La carpeta se pide EN EL
-- PROCESO: si la app tiene el documento y no sabe dónde va, muestra el ícono rojo; el usuario escribe la ruta como la
-- ve en su PC (`I:\Mi unidad\SAN MANUEL\IMPUESTOS\…\INMOBILIARIO`), el GAS la busca en el Drive y devuelve su id.
--   · Se guarda el ID de la carpeta, no sólo la ruta: si el usuario la mueve o la renombra, el id sigue valiendo.
--   · `ruta` es como la escribió el usuario (para mostrarla); `ruta_drive` es la que devolvió el Drive la última vez.
--   · `por_anio`: adentro se usa (o se crea) la carpeta del año — JMS: «la carpeta 2026 si existe la usa y si no la crea».
-- Arranca con la fila de ARBA Inmobiliario SIN carpeta (la pone el usuario desde el panel).
--
-- Escribe: crea la tabla (FRENA si existe) con 1 fila + 1 fila en recurso_tablas (recurso `egresos`, como las boletas),
-- todo marcado '[script 148]'. No toca ninguna tabla ni fila existente.
-- Deshacer: 148-archivo-destinos-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.archivo_destinos') is not null then raise exception 'archivo_destinos YA EXISTE: no se corre nada.'; end if;
end $$;

create table public.archivo_destinos (
  clave text primary key check (clave ~ '^[a-z0-9_]+$'),   -- 'arba_inmobiliario'
  nombre text not null,                                       -- 'ARBA Inmobiliario'
  ruta text,                                                  -- como la escribió el usuario
  drive_folder_id text,                                       -- vacío = todavía no se sabe dónde va (ícono rojo)
  ruta_drive text,                                            -- la ruta que devolvió el Drive al resolverla
  por_anio boolean not null default true,                     -- adentro, la carpeta del año (find-or-create)
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.archivo_destinos is '[script 148] A-FEAT-1442 — carpeta del Drive donde se archiva cada tipo de documento (por id: sobrevive a mover la carpeta).';

insert into public.archivo_destinos (clave, nombre, por_anio, nota)
values ('arba_inmobiliario', 'ARBA Inmobiliario', true, '[script 148] adentro: año → subcarpeta por empresa (MSA, «MSA - viene PAM»…)');

alter table public.archivo_destinos enable row level security;
create policy ver_segun_permiso on public.archivo_destinos for select to authenticated using (public.puede_ver('public', 'archivo_destinos'));
create policy escribir_segun_permiso on public.archivo_destinos for all to authenticated
  using (public.puede_escribir('public', 'archivo_destinos')) with check (public.puede_escribir('public', 'archivo_destinos'));
revoke all on public.archivo_destinos from anon;
grant select, insert, update, delete on public.archivo_destinos to authenticated;
grant all on public.archivo_destinos to service_role;
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
  values ('public', 'archivo_destinos', 'egresos', '[script 148] Carpetas del archivo digital por tipo de documento (A-FEAT-1442).', false)
  on conflict do nothing;

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee) ───────────────────────────────────────────────────────────────────────────────────────
select (select count(*) from public.archivo_destinos) as destinos,                                   -- 1
       (select count(*) from public.recurso_tablas where tabla = 'archivo_destinos') as en_recursos;  -- 1
