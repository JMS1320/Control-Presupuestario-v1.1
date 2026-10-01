-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 66 · Las 7 tablas de SUELDOS entran al mapeo de secciones      A-OP-24 · A-SEC-12 · 2026-10-01
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- QUÉ PASA HOY
--   `sueldos.*` nunca se anotó en `public.recurso_tablas`. Y `nivel_tabla()` tiene el default al
--   revés (A-SEC-09): una tabla NO registrada devuelve `escritura` a cualquiera con rol. Javier lo
--   midió el 2026-09-29 con el token de un contable real (A-TEST-148): «nivel_tabla(sueldos,
--   empleados) con su token devuelve escritura». Encima, las 7 tienen una policy vieja,
--   `solo_usuarios_habilitados`, que sólo pregunta `tiene_rol()` — o sea, cualquier rol.
--
--   👉 Cualquier cuenta con un rol —contable, pruebas, productivo— puede ESCRIBIR sueldos.
--
-- QUÉ HACE
--   1. Registra las 7 tablas bajo el recurso `sueldos`, que ya es una sección de los roles.
--   2. Cambia la policy vieja por el par que usan las otras 122 (`ver_segun_permiso` +
--      `escribir_segun_permiso`). Copiado de `msa.cheques`, no inventado.
--
-- QUÉ NO HACE — y es a propósito
--   `restringe_lectura` queda en FALSE. La lectura compartida es una decisión de `scripts/63`
--   («una tabla se escribe desde un lado y se lee desde varios»), y sueldos se LEE desde 5
--   secciones: Sueldos, Extracto, Cash Flow, Presupuesto y **Egresos** (los pagos agrupados).
--   Restringirla rompe pantallas de otras secciones, así que es una decisión aparte, de a una y
--   midiendo, como pidió Javier. Este script cierra sólo la ESCRITURA.
--
-- QUIÉN QUEDA CÓMO (medido sobre `public.roles` el 2026-10-01)
--   admin, socio                  → tienen la sección `sueldos` → siguen escribiendo, no cambia nada
--   contable, pruebas, productivo → no la tienen → pasan de `escritura` a `ninguno`
--
-- ⚠️ ATÓMICO: dentro de begin/commit. Con la RLS encendida y CERO policies la tabla queda cerrada
--   a todos — si el drop y el create no van juntos, la pantalla de Sueldos se cae en el medio.
-- 🔙 Se deshace con `scripts/66-67-deshacer.sql`.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura) values
  ('sueldos', 'campanas',            'sueldos', 'A-SEC-12: sueldos no estaba mapeado; el default al revés daba escritura a cualquier rol', false),
  ('sueldos', 'componentes_salario', 'sueldos', 'A-SEC-12: sueldos no estaba mapeado; el default al revés daba escritura a cualquier rol', false),
  ('sueldos', 'config',              'sueldos', 'A-SEC-12: sueldos no estaba mapeado; el default al revés daba escritura a cualquier rol', false),
  ('sueldos', 'cuentas_empleado',    'sueldos', 'A-SEC-12: sueldos no estaba mapeado; el default al revés daba escritura a cualquier rol', false),
  ('sueldos', 'empleados',           'sueldos', 'A-SEC-12: sueldos no estaba mapeado; el default al revés daba escritura a cualquier rol', false),
  ('sueldos', 'pagos',               'sueldos', 'A-SEC-12: sueldos no estaba mapeado; el default al revés daba escritura a cualquier rol', false),
  ('sueldos', 'periodos',            'sueldos', 'A-SEC-12: sueldos no estaba mapeado; el default al revés daba escritura a cualquier rol', false)
on conflict (schema_nombre, tabla) do nothing;

do $$
declare t text;
begin
  foreach t in array array['campanas','componentes_salario','config','cuentas_empleado','empleados','pagos','periodos']
  loop
    execute format('drop policy if exists solo_usuarios_habilitados on sueldos.%I', t);
    execute format('drop policy if exists ver_segun_permiso on sueldos.%I', t);
    execute format('drop policy if exists escribir_segun_permiso on sueldos.%I', t);
    execute format('create policy ver_segun_permiso on sueldos.%I for select to authenticated using (public.puede_ver(%L, %L))', t, 'sueldos', t);
    execute format('create policy escribir_segun_permiso on sueldos.%I for all to authenticated using (public.puede_escribir(%L, %L)) with check (public.puede_escribir(%L, %L))', t, 'sueldos', t, 'sueldos', t);
  end loop;
end $$;

commit;
