-- Borrar TODAS las columnas de la tabla msa_galicia
-- Esto dejará la tabla completamente vacía (sin columnas)

DO $$
DECLARE
    col_name TEXT;
BEGIN
    -- Obtener todas las columnas de la tabla msa_galicia
    FOR col_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'msa_galicia'
        ORDER BY ordinal_position
    LOOP
        -- Eliminar cada columna una por una
        EXECUTE 'ALTER TABLE msa_galicia DROP COLUMN IF EXISTS ' || quote_ident(col_name) || ' CASCADE';
        RAISE NOTICE 'Columna eliminada: %', col_name;
    END LOOP;
    
    RAISE NOTICE 'Todas las columnas han sido eliminadas de msa_galicia';
END $$;

-- Verificar que no queden columnas
SELECT 
    COUNT(*) as columnas_restantes,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ TABLA SIN COLUMNAS'
        ELSE '❌ AÚN HAY ' || COUNT(*) || ' COLUMNAS'
    END as estado
FROM information_schema.columns 
WHERE table_name = 'msa_galicia';

-- Mostrar que la tabla existe pero sin columnas
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'msa_galicia';
