-- Recrear el vínculo (foreign key) entre msa_galicia.interno y distribucion_socios.interno

-- 1. Verificar si ya existe la constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'msa_galicia' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'msa_galicia_interno_fkey'
    ) THEN
        RAISE NOTICE 'Foreign key ya existe, eliminándola para recrear';
        ALTER TABLE msa_galicia DROP CONSTRAINT msa_galicia_interno_fkey;
    END IF;
END $$;

-- 2. Verificar datos huérfanos antes de crear la constraint
SELECT 
    'Verificando valores huérfanos' as verificacion,
    COUNT(*) as cantidad_huerfanos
FROM msa_galicia m 
LEFT JOIN distribucion_socios d ON m.interno = d.interno 
WHERE m.interno IS NOT NULL 
AND m.interno != ''
AND d.interno IS NULL;

-- 3. Mostrar valores huérfanos si los hay
SELECT 
    'Valores huérfanos en msa_galicia.interno:' as titulo,
    m.interno as valor_huerfano,
    COUNT(*) as cantidad_registros
FROM msa_galicia m 
LEFT JOIN distribucion_socios d ON m.interno = d.interno 
WHERE m.interno IS NOT NULL 
AND m.interno != ''
AND d.interno IS NULL
GROUP BY m.interno
ORDER BY m.interno;

-- 4. Crear la foreign key constraint
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
        RAISE NOTICE 'Los valores huérfanos se muestran arriba.';
    END IF;
END $$;

-- 5. Verificar que la constraint se creó
SELECT 
    tc.constraint_name as nombre_constraint,
    tc.constraint_type as tipo,
    kcu.column_name as columna_origen,
    ccu.table_name as tabla_destino,
    ccu.column_name as columna_destino
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'msa_galicia'
AND kcu.column_name = 'interno';
