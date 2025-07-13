-- Recrear la foreign key entre msa_galicia.interno y distribucion_socios.interno

-- 1. Verificar datos existentes en msa_galicia con campo interno
SELECT 
    'Verificando datos en msa_galicia.interno' as verificacion,
    COUNT(*) as total_con_interno,
    COUNT(DISTINCT interno) as valores_unicos
FROM msa_galicia 
WHERE interno IS NOT NULL AND interno != '';

-- 2. Mostrar valores únicos de interno en msa_galicia
SELECT 
    'Valores únicos en msa_galicia.interno:' as titulo,
    interno,
    COUNT(*) as cantidad_movimientos
FROM msa_galicia 
WHERE interno IS NOT NULL AND interno != ''
GROUP BY interno 
ORDER BY interno;

-- 3. Verificar si hay valores huérfanos
SELECT 
    'Verificando valores huérfanos' as verificacion,
    COUNT(*) as cantidad_huerfanos
FROM msa_galicia m 
LEFT JOIN distribucion_socios d ON m.interno = d.interno 
WHERE m.interno IS NOT NULL 
AND m.interno != ''
AND d.interno IS NULL;

-- 4. Mostrar valores huérfanos específicos (si los hay)
SELECT 
    'Valores huérfanos específicos:' as titulo,
    m.interno as valor_huerfano,
    COUNT(*) as cantidad_registros
FROM msa_galicia m 
LEFT JOIN distribucion_socios d ON m.interno = d.interno 
WHERE m.interno IS NOT NULL 
AND m.interno != ''
AND d.interno IS NULL
GROUP BY m.interno
ORDER BY m.interno;

-- 5. Crear la foreign key constraint
DO $$
BEGIN
    -- Verificar si hay datos huérfanos
    IF NOT EXISTS (
        SELECT 1 FROM msa_galicia m 
        LEFT JOIN distribucion_socios d ON m.interno = d.interno 
        WHERE m.interno IS NOT NULL 
        AND m.interno != ''
        AND d.interno IS NULL
    ) THEN
        -- No hay huérfanos, crear la constraint
        ALTER TABLE msa_galicia 
        ADD CONSTRAINT msa_galicia_interno_fkey 
        FOREIGN KEY (interno) REFERENCES distribucion_socios(interno);
        
        RAISE NOTICE '✅ Foreign key constraint creada exitosamente';
    ELSE
        RAISE NOTICE '⚠️ Hay valores huérfanos. Foreign key constraint NO creada.';
        RAISE NOTICE 'Revisar los valores huérfanos mostrados arriba.';
    END IF;
END $$;

-- 6. Verificar que la constraint se creó correctamente
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
AND tc.table_name = 'msa_galicia'
AND kcu.column_name = 'interno';
