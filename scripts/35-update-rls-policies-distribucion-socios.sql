-- Actualizar las políticas RLS para la tabla renombrada
-- Las políticas anteriores pueden haber quedado huérfanas

-- 1. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Allow public read on categorias_interno" ON distribucion_socios;
DROP POLICY IF EXISTS "Allow public insert on categorias_interno" ON distribucion_socios;
DROP POLICY IF EXISTS "Allow public update on categorias_interno" ON distribucion_socios;
DROP POLICY IF EXISTS "Allow public delete on categorias_interno" ON distribucion_socios;

-- 2. Crear nuevas políticas con nombres correctos
CREATE POLICY "Allow public read on distribucion_socios" ON distribucion_socios FOR SELECT USING (true);
CREATE POLICY "Allow public insert on distribucion_socios" ON distribucion_socios FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on distribucion_socios" ON distribucion_socios FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on distribucion_socios" ON distribucion_socios FOR DELETE USING (true);

-- 3. Verificar que RLS sigue habilitado
SELECT 
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables 
WHERE tablename = 'distribucion_socios';

-- 4. Mostrar las políticas actuales
SELECT 
    policyname as nombre_politica,
    cmd as comando,
    permissive as permisiva
FROM pg_policies 
WHERE tablename = 'distribucion_socios'
ORDER BY policyname;
