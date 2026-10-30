-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔒 Script 142 — A-FEAT-1425: las tablas de MAILS se leen y escriben SÓLO con el admin
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-30: «ok, cerrá la lectura y después instalo el gas».
--
-- Por qué: con la regla de lectura de la base (`puede_ver`, scripts 63/65), una tabla NO marcada `restringe_lectura`
-- la lee cualquier rol logueado; y colgadas de `egresos`, `contable` además las escribía. Tienen mails de la familia
-- y de la sucesión. `importar` es la única sección que hoy tiene sólo `admin` → recurso `importar.mails`.
--   ⚠️ Si algún día un rol recibe la sección `importar`, también vería los mails (avisado en ENTRE-DESARROLLADORES).
-- El GAS escribe con `service_role`, que no pasa por estos permisos: no lo afecta.
--
-- Escribe: 2 filas de public.recurso_tablas (las del script 140), marcadas '[script 142]' en `motivo`. Nada más.
-- Deshacer: 142-mails-lectura-solo-admin-deshacer.sql. Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

do $$
declare n int;
begin
  select count(*) into n from public.recurso_tablas
   where schema_nombre = 'public' and tabla in ('mails_registro','mails_reglas') and recurso = 'egresos' and motivo like '[script 140]%';
  if n <> 2 then raise exception 'Se esperaban las 2 filas del script 140 colgadas de egresos y hay %: no se corre nada.', n; end if;
end $$;

update public.recurso_tablas
   set recurso = 'importar.mails', restringe_lectura = true,
       motivo = '[script 142] Sólo admin: mails de la familia y la sucesión (A-FEAT-1425). Antes: ' || motivo
 where schema_nombre = 'public' and tabla in ('mails_registro','mails_reglas') and recurso = 'egresos' and motivo like '[script 140]%';

commit;

-- ── Control (sólo lee): cada rol, simulado con su JWT, contra las 2 tablas ────────────────────────────────────
-- Esperado: admin ver=true escribir=true · contable / socio / productivo / pruebas: false false.
select ro.id as rol,
       (select set_config('request.jwt.claims', json_build_object('app_metadata', json_build_object('role', ro.id))::text, true)) is not null as _,
       public.puede_ver('public','mails_registro') as ver_registro, public.puede_escribir('public','mails_registro') as escribir_registro,
       public.puede_ver('public','mails_reglas') as ver_reglas
from public.roles ro order by ro.id;
