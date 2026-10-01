-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 67 · Las 13 vistas de `public` respetan al que consulta              A-SEC-12 · 2026-10-01
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- QUÉ PASA HOY
--   Una vista en Postgres corre con los permisos de SU DUEÑO, salvo `security_invoker = true`.
--   Las 13 vistas de `public` son de `postgres` y ninguna lo tiene. Entonces **la RLS de la tabla
--   de atrás no se aplica** cuando se entra por la vista — y la app entra por la vista: es el
--   mismo descubrimiento de A-BUG-1229 (la cuota alimentaria), visto desde la seguridad.
--
--   👉 Sin este script, `scripts/66` es decorativo: la regla nueva queda en la tabla y la app
--      sigue escribiendo por una puerta que no la consulta.
--
-- LAS 13, Y POR QUÉ NO PESAN IGUAL
--   · 7 de SUELDOS, una por tabla (1:1) → son ACTUALIZABLES. Acá está el agujero de escritura.
--   · 6 de lectura (4 del Presupuesto, `ventas_unificadas`, `control_has_por_campana`) → llevan
--     cruces y agregados, un UPDATE fallaría solo. Y como la lectura es compartida por diseño
--     (scripts/63), HOY no filtran nada que la regla no permita. Se marcan igual por PREVENCIÓN:
--     el día que alguien encienda `restringe_lectura` en una de sus tablas, la vista lo saltearía
--     en silencio.
--
-- ⚠️ LO QUE ROMPIÓ LA ÚLTIMA VEZ, y por qué acá no (verificado 2026-10-01)
--   `scripts/65` existe porque una función perdió un permiso y dio 403 a todos. Con
--   `security_invoker` el riesgo equivalente es que el que consulta NO tenga permiso sobre la
--   tabla de atrás. Medido: `authenticated` tiene USAGE en los 4 schemas y SELECT en las 27
--   tablas de atrás (7 de sueldos + 20 de las otras 6 vistas). No hay hueco de GRANT.
--
-- `alter view … set (…)` NO toca los GRANTs (a diferencia de un drop + create).
-- 🔙 Se deshace con `scripts/66-67-deshacer.sql`.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

alter view public.sueldos_campanas                      set (security_invoker = true);
alter view public.sueldos_componentes_salario           set (security_invoker = true);
alter view public.sueldos_config                        set (security_invoker = true);
alter view public.sueldos_cuentas_empleado              set (security_invoker = true);
alter view public.sueldos_empleados                     set (security_invoker = true);
alter view public.sueldos_pagos                         set (security_invoker = true);
alter view public.sueldos_periodos                      set (security_invoker = true);

alter view public.presupuesto_cobertura_canales         set (security_invoker = true);
alter view public.presupuesto_historia_canales          set (security_invoker = true);
alter view public.presupuesto_historia_cuenta_proveedor set (security_invoker = true);
alter view public.presupuesto_historia_cuentas          set (security_invoker = true);
alter view public.ventas_unificadas                     set (security_invoker = true);
alter view public.control_has_por_campana               set (security_invoker = true);

commit;
