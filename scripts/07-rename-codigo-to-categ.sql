-- Renombrar columna codigo a categ en la tabla cuentas_contables
-- y asegurar la estructura correcta

DO $$ 
BEGIN
    -- Verificar si la columna 'categ' ya existe
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'cuentas_contables' AND column_name = 'categ') THEN
        
        -- Si 'categ' existe, eliminar la columna 'codigo' si existe
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cuentas_contables' AND column_name = 'codigo') THEN
            ALTER TABLE cuentas_contables DROP COLUMN codigo;
            RAISE NOTICE 'Columna codigo eliminada porque categ ya existe';
        END IF;
        
    ELSE
        -- Si 'categ' no existe, renombrar 'codigo' a 'categ'
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cuentas_contables' AND column_name = 'codigo') THEN
            ALTER TABLE cuentas_contables RENAME COLUMN codigo TO categ;
            RAISE NOTICE 'Columna codigo renombrada a categ';
        ELSE
            -- Si no existe ni 'codigo' ni 'categ', crear 'categ'
            ALTER TABLE cuentas_contables ADD COLUMN categ TEXT NOT NULL UNIQUE;
            RAISE NOTICE 'Columna categ creada';
        END IF;
    END IF;
    
    -- Asegurar que categ tenga la restricción UNIQUE si no la tiene
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc
                   JOIN information_schema.key_column_usage kcu 
                   ON tc.constraint_name = kcu.constraint_name
                   WHERE tc.table_name = 'cuentas_contables' 
                   AND kcu.column_name = 'categ' 
                   AND tc.constraint_type = 'UNIQUE') THEN
        ALTER TABLE cuentas_contables ADD CONSTRAINT cuentas_contables_categ_unique UNIQUE (categ);
        RAISE NOTICE 'Restricción UNIQUE agregada a columna categ';
    END IF;
    
END $$;

-- Verificar la estructura final de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'cuentas_contables' 
ORDER BY ordinal_position;

-- Mostrar las restricciones de la tabla
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'cuentas_contables';
