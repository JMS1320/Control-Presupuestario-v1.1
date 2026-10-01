-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 🔍 VERIFICAR 66 y 67 — con la IDENTIDAD de cada rol, no con admin ni con service_role
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- La lección de `scripts/65` y de A-TEST-148: un permiso NO se prueba con el rol que tiene todos
-- los permisos. `service_role` saltea la RLS y `anon` no llega: verificar con esos dos da una
-- confianza sin respaldo. Acá se simula el JWT de cada rol con `set local`, dentro de una
-- transacción que termina en ROLLBACK — **sólo lectura, no escribe nada**.
--
-- Se corre una vez por rol (cambiando el rol en el claim). Resultado medido el 2026-10-01,
-- ANTES de correr 66/67, con `pruebas`:
--
--   nivel_escritura_sueldos = escritura   ← el agujero
--   puede_escribir_pagos    = true        ← el agujero
--   lee_empleados_por_vista = 9           ← lectura compartida, por diseño (scripts/63)
--   nivel_cheques_control   = escritura   ← 🧨 NO es de sueldos: cheques tampoco está mapeado
--
-- 🧨 Y ESE TESTIGO DESTAPÓ EL TAMAÑO REAL (medido 2026-10-01): de las 129 tablas con policy,
--   **63 están mapeadas a una sección y 66 NO** — y una tabla sin mapear da `escritura` a
--   CUALQUIER rol (es el default al revés de A-SEC-09, que sigue abierto). Por schema:
--   public 48 · msa 7 · sueldos 7 · ma 2 · pam 2. Entre ellas: proveedores, templates_master,
--   cuentas_contables, cuotas_egresos_sin_factura, cheques, grupos_pago, sicore_retenciones,
--   anticipos_proveedores, mails_pago.
--   👉 66/67 cierran SUELDOS (7 de las 66), que es lo más sensible y la única sin ambigüedad de
--   sección. Las otras 59 necesitan una decisión tabla por tabla: varias se escriben desde más de
--   una sección (proveedores: Egresos, Cash Flow e Ingresos) y el mapeo admite UNA sola. Mapear
--   mal le saca la herramienta a quien la necesita — el contable necesita escribir templates y
--   proveedores para hacer su trabajo.
--
-- ESPERADO DESPUÉS de 66 + 67:
--   rol pruebas / contable / productivo → sueldos: `ninguno` · puede_escribir: false · lee: 9
--   rol admin / socio                   → sueldos: `escritura` · puede_escribir: true · lee: 9
--   y `nivel_cheques_control` NO cambia (sigue `escritura`): cheques no está en este arreglo.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"pruebas"}}';
select 'pruebas' as rol,
  public.nivel_tabla('sueldos','empleados')   as nivel_escritura_sueldos,
  public.puede_escribir('sueldos','pagos')    as puede_escribir_pagos,
  (select count(*) from public.sueldos_empleados) as lee_empleados_por_vista,
  public.nivel_tabla('msa','cheques')         as nivel_cheques_control;
rollback;

-- ── Estructura: que las 13 vistas queden con security_invoker y las 7 tablas con su par ───────
select c.relname as vista,
  coalesce((select option_value from pg_options_to_table(c.reloptions)
            where option_name = 'security_invoker'), '(no puesto)') as security_invoker
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v' order by 1;

select tablename, string_agg(policyname || ' (' || cmd || ')', ', ' order by policyname) as politicas
from pg_policies where schemaname = 'sueldos' group by tablename order by 1;
