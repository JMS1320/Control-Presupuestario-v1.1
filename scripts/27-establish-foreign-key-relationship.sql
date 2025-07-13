-- Establecer relación entre msa_galicia.categ y cuentas_contables.categ

-- 1. Primero, eliminar cualquier constraint existente si existe
DO $$
BEGIN
    -- Buscar y eliminar constraints de foreign key existentes
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'msa_galicia' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%categ%'
    ) THEN
        ALTER TABLE msa_galicia DROP CONSTRAINT IF EXISTS msa_galicia_categ_fkey;
        RAISE NOTICE 'Foreign key constraint eliminada';
    END IF;
END $$;

-- 2. Verificar que no hay datos huérfanos antes de crear la constraint
SELECT 
    'Verificando datos huérfanos' as verificacion,
    COUNT(*) as registros_huerfanos
FROM msa_galicia m 
LEFT JOIN cuentas_contables c ON m.categ = c.categ 
WHERE m.categ IS NOT NULL 
AND c.categ IS NULL;

-- 3. Mostrar categorías huérfanas si las hay
SELECT DISTINCT 
    m.categ as categoria_huerfana,
    COUNT(*) as cantidad_registros
FROM msa_galicia m 
LEFT JOIN cuentas_contables c ON m.categ = c.categ 
WHERE m.categ IS NOT NULL 
AND c.categ IS NULL
GROUP BY m.categ;

-- 4. Crear la foreign key constraint
ALTER TABLE msa_galicia 
ADD CONSTRAINT msa_galicia_categ_fkey 
FOREIGN KEY (categ) REFERENCES cuentas_contables(categ);

-- 5. Verificar que la constraint se creó correctamente
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'msa_galicia'
AND kcu.column_name = 'categ';

-- 6. Mensaje de confirmación
SELECT 'Foreign key establecida exitosamente entre msa_galicia.categ y cuentas_contables.categ' as mensaje;
