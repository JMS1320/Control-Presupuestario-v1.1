-- Actualizar la referencia de foreign key en msa_galicia
-- para que apunte a la columna 'categ' en lugar de 'codigo'

DO $$
BEGIN
    -- Eliminar la constraint de foreign key existente si existe
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE table_name = 'msa_galicia' 
               AND constraint_type = 'FOREIGN KEY'
               AND constraint_name LIKE '%categ%') THEN
        
        -- Buscar el nombre exacto de la constraint
        DECLARE
            constraint_name_var TEXT;
        BEGIN
            SELECT constraint_name INTO constraint_name_var
            FROM information_schema.table_constraints 
            WHERE table_name = 'msa_galicia' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%categ%'
            LIMIT 1;
            
            IF constraint_name_var IS NOT NULL THEN
                EXECUTE 'ALTER TABLE msa_galicia DROP CONSTRAINT ' || constraint_name_var;
                RAISE NOTICE 'Constraint de foreign key eliminada: %', constraint_name_var;
            END IF;
        END;
    END IF;
    
    -- Crear la nueva foreign key constraint
    ALTER TABLE msa_galicia 
    ADD CONSTRAINT msa_galicia_categ_fkey 
    FOREIGN KEY (categ) REFERENCES cuentas_contables(categ);
    
    RAISE NOTICE 'Nueva foreign key constraint creada: msa_galicia_categ_fkey';
    
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error al actualizar foreign key: %', SQLERRM;
END $$;

-- Verificar que la foreign key esté correctamente configurada
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
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
