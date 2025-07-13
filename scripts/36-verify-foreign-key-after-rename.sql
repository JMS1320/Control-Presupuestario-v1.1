-- Verificar que la foreign key sigue funcionando después del rename

-- 1. Verificar que la constraint de foreign key existe y funciona
SELECT 
    tc.constraint_name as nombre_constraint,
    tc.constraint_type as tipo,
    kcu.column_name as columna_local,
    ccu.table_name as tabla_referenciada,
    ccu.column_name as columna_referenciada
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND (tc.table_name = 'msa_galicia' OR ccu.table_name = 'distribucion_socios')
AND kcu.column_name = 'interno';

-- 2. Probar el JOIN entre las tablas para verificar que funciona
SELECT 
    'Prueba de JOIN después del rename' as verificacion,
    COUNT(*) as movimientos_con_distribucion
FROM msa_galicia m
INNER JOIN distribucion_socios d ON m.interno = d.interno;

-- 3. Mostrar algunos ejemplos del JOIN funcionando
SELECT 
    m.fecha,
    m.descripcion,
    m.interno,
    d.concepto,
    m.creditos,
    m.debitos
FROM msa_galicia m
INNER JOIN distribucion_socios d ON m.interno = d.interno
ORDER BY m.fecha DESC
LIMIT 5;

-- 4. Verificar valores huérfanos (si los hay)
SELECT 
    'Valores en msa_galicia sin match en distribucion_socios' as verificacion,
    COUNT(*) as cantidad_huerfanos
FROM msa_galicia m 
LEFT JOIN distribucion_socios d ON m.interno = d.interno 
WHERE m.interno IS NOT NULL 
AND m.interno != ''
AND d.interno IS NULL;
