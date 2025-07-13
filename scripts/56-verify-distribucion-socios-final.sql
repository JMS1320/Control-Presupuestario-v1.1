-- Verificar la estructura final de distribucion_socios

-- 1. Estructura completa de la tabla
SELECT '=== ESTRUCTURA FINAL ===' as titulo;
SELECT 
    ordinal_position as "#",
    column_name as columna,
    data_type as tipo,
    is_nullable as acepta_null
FROM information_schema.columns 
WHERE table_name = 'distribucion_socios' 
ORDER BY ordinal_position;

-- 2. Datos organizados por sección
SELECT '=== SECCIÓN 1 ===' as titulo;
SELECT 
    orden,
    interno,
    concepto
FROM distribucion_socios 
WHERE seccion = 1
ORDER BY orden;

SELECT '=== SECCIÓN 2 ===' as titulo;
SELECT 
    orden,
    interno,
    concepto
FROM distribucion_socios 
WHERE seccion = 2
ORDER BY orden;

-- 3. Resumen final
SELECT 
    'Total filas' as metrica,
    COUNT(*)::text as valor
FROM distribucion_socios
UNION ALL
SELECT 
    'Filas sección 1',
    COUNT(*)::text
FROM distribucion_socios 
WHERE seccion = 1
UNION ALL
SELECT 
    'Filas sección 2',
    COUNT(*)::text
FROM distribucion_socios 
WHERE seccion = 2;
