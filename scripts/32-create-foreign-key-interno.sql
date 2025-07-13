-- Establecer relación entre msa_galicia.interno y categorias_interno.interno

-- 1. Verificar datos existentes en msa_galicia con campo interno
SELECT 
    'Verificando campo interno en msa_galicia' as verificacion,
    COUNT(*) as total_registros,
    COUNT(DISTINCT interno) as valores_unicos_interno
FROM msa_galicia 
WHERE interno IS NOT NULL AND interno != '';

-- 2. Mostrar valores únicos de interno en msa_galicia
SELECT 
    interno,
    COUNT(*) as cantidad_movimientos
FROM msa_galicia 
WHERE interno IS NOT NULL AND interno != ''
GROUP BY interno 
ORDER BY interno;

-- 3. Verificar si hay valores huérfanos (que no existen en categorias_interno)
SELECT 
    'Valores huérfanos en msa_galicia.interno' as verificacion,
    COUNT(*) as cantidad
FROM msa_galicia m 
LEFT JOIN categorias_interno c ON m.interno = c.interno 
WHERE m.interno IS NOT NULL 
AND m.interno != ''
AND c.interno IS NULL;

-- 4. Mostrar valores huérfanos específicos si los hay
SELECT DISTINCT 
    m.interno as valor_huerfano,
    COUNT(*) as cantidad_registros
FROM msa_galicia m 
LEFT JOIN categorias_interno c ON m.interno = c.interno 
WHERE m.interno IS NOT NULL 
AND m.interno != ''
AND c.interno IS NULL
GROUP BY m.interno
ORDER BY m.interno;

-- 5. Crear la foreign key constraint (solo si no hay huérfanos)
-- Nota: Esta constraint será opcional dependiendo de los datos existentes
DO $$
BEGIN
    -- Verificar si hay datos huérfanos
    IF NOT EXISTS (
        SELECT 1 FROM msa_galicia m 
        LEFT JOIN categorias_interno c ON m.interno = c.interno 
        WHERE m.interno IS NOT NULL 
        AND m.interno != ''
        AND c.interno IS NULL
    ) THEN
        -- No hay huérfanos, crear la constraint
        ALTER TABLE msa_galicia 
        ADD CONSTRAINT msa_galicia_interno_fkey 
        FOREIGN KEY (interno) REFERENCES categorias_interno(interno);
        
        RAISE NOTICE 'Foreign key constraint creada exitosamente';
    ELSE
        RAISE NOTICE 'Hay valores huérfanos. Foreign key constraint NO creada. Revisar datos primero.';
    END IF;
END $$;
