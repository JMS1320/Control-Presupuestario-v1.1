-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 60 · Los permisos de cada rol salen de la base, no del código      A-FEAT-82 · 2026-09-05
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Hasta acá qué veía cada rol estaba escrito en `seccionesDe()` (components/layout-app.tsx), así
-- que cambiarlo era tocar código y desplegar. Esto lo mueve a una tabla para que el admin lo
-- edite desde Configuración → Roles.
--
-- DECISIONES, con su motivo:
--
--   · `admin` es **rol de sistema y NO se edita** (`es_sistema = true`). Si se pudiera, alguien se
--     quita secciones y **deja el sistema sin nadie que pueda administrarlo** — un candado sin
--     llave. Se protege con un trigger, no sólo con la UI: la UI se saltea con un fetch.
--
--   · Los permisos son **por sección** (las 12 solapas), no por acción (ver/editar/borrar).
--     ⚠️ NO se agregó una columna de acciones "para el futuro": una columna de permisos que
--     ninguna guarda chequea **parece un permiso y no lo es**, que es peor que no tenerla. Cuando
--     se necesite, se agrega junto con el código que la aplique.
--
--   · `exige_2fa` también sale de acá: es parte de lo que define a un rol.
--
-- Idempotente y NO destructivo: si la tabla ya existe no se toca, y las filas se insertan sólo si
-- faltan (los permisos ya editados por el usuario NO se pisan).
-- ─────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.roles (
  id          text primary key,
  descripcion text not null default '',
  -- Los ids de las secciones, los mismos que usa el menú lateral: principal, dashboard, etc.
  secciones   text[] not null default '{}',
  exige_2fa   boolean not null default false,
  -- Un rol de sistema no se puede editar ni borrar.
  es_sistema  boolean not null default false,
  actualizado timestamptz not null default now()
);

-- Semilla con los dos roles que ya existían, tal como estaban en el código.
insert into public.roles (id, descripcion, secciones, exige_2fa, es_sistema)
values
  ('admin',
   'Ve y edita todo el sistema. Es el rol del dueño de la información.',
   array['principal','dashboard','distribucion','reporte','egresos','ingresos','cashflow','extracto','productivo','sueldos','presupuesto','importar'],
   true,
   true),
  ('contable',
   'Acceso acotado, para delegar la carga sin abrir el resto del sistema.',
   array['egresos'],
   false,
   false)
on conflict (id) do nothing;   -- ⚠️ `do nothing`: no pisa lo que el usuario ya haya editado.

-- ── El candado de `admin` ────────────────────────────────────────────────────────────────────
-- En el trigger y no sólo en la pantalla: la pantalla se saltea con un fetch a mano.
create or replace function public.roles_proteger_sistema()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.es_sistema then
      raise exception 'El rol «%» es de sistema y no se puede borrar.', old.id;
    end if;
    return old;
  end if;

  if old.es_sistema then
    -- De un rol de sistema sólo se deja cambiar la descripción; permisos y 2FA quedan fijos.
    if new.secciones is distinct from old.secciones
       or new.exige_2fa is distinct from old.exige_2fa
       or new.es_sistema is distinct from old.es_sistema
       or new.id is distinct from old.id then
      raise exception 'El rol «%» es de sistema: no se le pueden cambiar los permisos.', old.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists roles_proteger_sistema on public.roles;
create trigger roles_proteger_sistema
  before update or delete on public.roles
  for each row execute function public.roles_proteger_sistema();

-- ── Acceso ───────────────────────────────────────────────────────────────────────────────────
-- RLS prendida y SIN políticas: nadie entra con la anon key. La lectura y la escritura pasan por
-- las rutas del servidor, que usan `service_role` y chequean el rol admin (A-SEC-06).
alter table public.roles enable row level security;
revoke all on public.roles from anon, authenticated;

-- Control: tiene que devolver 2 filas, admin con 12 secciones y contable con 1.
select id, cardinality(secciones) as n_secciones, exige_2fa, es_sistema
from public.roles order by id;
