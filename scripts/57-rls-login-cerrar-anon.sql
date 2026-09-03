-- =====================================================================================
-- 57 — CERRAR `anon` Y ABRIR RLS POR SESIÓN
-- Fecha: 2026-09-03 · Cierra: A-SEC-03 (módulo Usuarios) y el corazón de A-SEC-01
-- =====================================================================================
--
-- QUÉ HACE
--   Hoy `anon` = `authenticated` = `service_role` tienen SELECT/INSERT/UPDATE/DELETE/TRUNCATE
--   sobre los 72 objetos, y las 41 policies RLS son todas `allow all` (auditoría 2026-06-23,
--   ARQUITECTURA-BD.md §5). Con la `anon_key` en el bundle JS, cualquiera borra todo con curl.
--
--   Como AHORA TODOS SE LOGUEAN (reemplazo total de las rutas-como-password, 2026-09-03),
--   `anon` ya no necesita NADA: sólo tiene que poder llegar al login. Revocarle todo es lo que
--   "mueve la aguja" según el propio dossier A-SEC-01.
--
-- ⚠️ CÓMO SE CORRE — NO EN BLOQUE
--   El protocolo de A-SEC-01 dice: listar el SQL exacto, ejecutar 1×1, tener el revert listo.
--   Este archivo respeta eso: cada paso es independiente y al final está el revert completo.
--   Correr los pasos 0 y 1 primero, VERIFICAR que la app sigue andando logueado, y recién
--   después el 2.
--
-- ⚠️ ORDEN OBLIGATORIO: primero las policies, después el ENABLE ROW LEVEL SECURITY.
--   Activar RLS sin policies deja la tabla ILEGIBLE hasta para el admin.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- PASO 0 — FOTO PREVIA (no cambia nada; guardar la salida antes de tocar)
-- -------------------------------------------------------------------------------------
SELECT n.nspname AS schema, c.relname AS objeto, c.relrowsecurity AS rls_activa, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','msa','pam','ma','productivo','sueldos')
  AND c.relkind IN ('r','v')
ORDER BY 1,2;

SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public','msa','pam','ma','productivo','sueldos')
ORDER BY 1,2,3;


-- -------------------------------------------------------------------------------------
-- PASO 1 — REVOCAR TODO A `anon`
--   Reversible al 100% con un GRANT (ver revert). No es DDL: sólo toca ACLs, no filas.
--   Una query bloqueada falla ANTES de tocar datos.
-- -------------------------------------------------------------------------------------
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['public','msa','pam','ma','productivo','sueldos'] LOOP
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon', s);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM anon', s);
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM anon', s);
    EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM anon', s);
    -- Que las tablas NUEVAS tampoco nazcan abiertas:
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM anon', s);
  END LOOP;
END $$;


-- -------------------------------------------------------------------------------------
-- PASO 2 — RLS REAL PARA `authenticated`
--   Reemplaza las 41 policies `allow all` por una que exige usuario logueado de verdad.
--   `TO authenticated` + `auth.uid() IS NOT NULL`: sin sesión válida no hay fila.
-- -------------------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS tab
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public','msa','pam','ma','productivo','sueldos')
      AND c.relkind = 'r'
  LOOP
    -- 1) limpiar las permisivas viejas
    EXECUTE format(
      'DO $inner$ DECLARE p record; BEGIN
         FOR p IN SELECT policyname FROM pg_policies WHERE schemaname=%L AND tablename=%L LOOP
           EXECUTE format(''DROP POLICY %%I ON %I.%I'', p.policyname);
         END LOOP; END $inner$', r.sch, r.tab, r.sch, r.tab);

    -- 2) policy única: sólo sesión válida
    EXECUTE format(
      'CREATE POLICY "solo_usuarios_logueados" ON %I.%I
         FOR ALL TO authenticated
         USING (auth.uid() IS NOT NULL)
         WITH CHECK (auth.uid() IS NOT NULL)', r.sch, r.tab);

    -- 3) recién ahora activar RLS (con la policy ya puesta)
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.sch, r.tab);
  END LOOP;
END $$;


-- -------------------------------------------------------------------------------------
-- PASO 3 — VERIFICACIÓN (debe dar CERO filas)
-- -------------------------------------------------------------------------------------
SELECT n.nspname, c.relname, 'RLS APAGADA' AS problema
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','msa','pam','ma','productivo','sueldos')
  AND c.relkind='r' AND c.relrowsecurity = false;

SELECT n.nspname, c.relname, 'anon TODAVIA TIENE PERMISOS' AS problema
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','msa','pam','ma','productivo','sueldos')
  AND c.relkind IN ('r','v')
  AND (has_table_privilege('anon', c.oid, 'SELECT')
    OR has_table_privilege('anon', c.oid, 'INSERT')
    OR has_table_privilege('anon', c.oid, 'UPDATE')
    OR has_table_privilege('anon', c.oid, 'DELETE'));


-- =====================================================================================
-- REVERT — dejar todo como estaba (pegar y correr si algo se rompe)
-- =====================================================================================
-- DO $$
-- DECLARE s text; r record;
-- BEGIN
--   FOREACH s IN ARRAY ARRAY['public','msa','pam','ma','productivo','sueldos'] LOOP
--     EXECUTE format('GRANT USAGE ON SCHEMA %I TO anon', s);
--     EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO anon', s);
--     EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO anon', s);
--   END LOOP;
--   FOR r IN SELECT n.nspname sch, c.relname tab FROM pg_class c
--            JOIN pg_namespace n ON n.oid=c.relnamespace
--            WHERE n.nspname IN ('public','msa','pam','ma','productivo','sueldos')
--              AND c.relkind='r' LOOP
--     EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', r.sch, r.tab);
--   END LOOP;
-- END $$;
