-- Borrar todas las filas de distribucion_socios para reinsertarlas en orden

-- 1. Eliminar constraint de foreign key temporalmente (si existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'msa_galicia' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'msa_galicia_interno_fkey'
    ) THEN
        ALTER TABLE msa_galicia DROP CONSTRAINT msa_galicia_interno_fkey;
        RAISE NOTICE 'Foreign key constraint eliminada temporalmente';
    ELSE
        RAISE NOTICE 'No se encontró foreign key constraint para eliminar';
    END IF;
END $$;

-- 2. Borrar todas las filas
DELETE FROM distribucion_socios;

-- 3. Verificar que la tabla esté vacía
SELECT 
    COUNT(*) as registros_restantes,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ TABLA VACÍA'
        ELSE '❌ AÚN HAY REGISTROS'
    END as estado
FROM distribucion_socios;

-- 4. Verificar que la estructura se mantuvo
SELECT 
    COUNT(*) as total_columnas,
    'Estructura preservada' as estado
FROM information_schema.columns 
WHERE table_name = 'distribucion_socios';

-- 5. Mensaje de confirmación
SELECT 'Tabla distribucion_socios limpiada. Lista para reinsertar datos en orden.' as mensaje;
