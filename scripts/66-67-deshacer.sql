-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 🔙 DESHACER 66 y 67 — vuelve EXACTAMENTE al estado del 2026-10-01 antes de correrlos
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Escrito ANTES de correr los otros dos, a propósito: un arreglo de permisos sobre la base de
-- producción no se corre sin tener la vuelta atrás en la mano.
--
-- El estado previo está MEDIDO, no supuesto (2026-10-01):
--   · las 7 tablas de sueldos tenían UNA policy `solo_usuarios_habilitados` (ALL, `tiene_rol()`),
--     con la RLS encendida y no forzada;
--   · ninguna estaba en `recurso_tablas`;
--   · ninguna de las 13 vistas tenía `security_invoker`.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

-- 67 al revés
alter view public.sueldos_campanas                      reset (security_invoker);
alter view public.sueldos_componentes_salario           reset (security_invoker);
alter view public.sueldos_config                        reset (security_invoker);
alter view public.sueldos_cuentas_empleado              reset (security_invoker);
alter view public.sueldos_empleados                     reset (security_invoker);
alter view public.sueldos_pagos                         reset (security_invoker);
alter view public.sueldos_periodos                      reset (security_invoker);
alter view public.presupuesto_cobertura_canales         reset (security_invoker);
alter view public.presupuesto_historia_canales          reset (security_invoker);
alter view public.presupuesto_historia_cuenta_proveedor reset (security_invoker);
alter view public.presupuesto_historia_cuentas          reset (security_invoker);
alter view public.ventas_unificadas                     reset (security_invoker);
alter view public.control_has_por_campana               reset (security_invoker);

-- 66 al revés
do $$
declare t text;
begin
  foreach t in array array['campanas','componentes_salario','config','cuentas_empleado','empleados','pagos','periodos']
  loop
    execute format('drop policy if exists ver_segun_permiso on sueldos.%I', t);
    execute format('drop policy if exists escribir_segun_permiso on sueldos.%I', t);
    execute format('drop policy if exists solo_usuarios_habilitados on sueldos.%I', t);
    execute format('create policy solo_usuarios_habilitados on sueldos.%I for all to authenticated using (public.tiene_rol()) with check (public.tiene_rol())', t);
  end loop;
end $$;

-- Sólo las 7 filas que agregó el 66 (las marca el motivo), nunca otras.
delete from public.recurso_tablas
 where schema_nombre = 'sueldos' and motivo like 'A-SEC-12:%';

commit;
