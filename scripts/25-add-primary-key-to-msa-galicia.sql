-- Agregar una clave primaria a la tabla msa_galicia
-- Esto permitirá borrar/editar filas desde la interfaz de Supabase

-- 1. Agregar columna ID como primera columna (clave primaria)
ALTER TABLE msa_galicia ADD COLUMN id UUID DEFAULT gen_random_uuid() PRIMARY KEY;

-- 2. Mover la columna ID al principio (opcional, para mejor organización)
-- Nota: En PostgreSQL no se puede cambiar el orden de columnas existentes fácilmente
-- Pero la clave primaria funcionará en cualquier posición

-- 3. Verificar que se agregó la clave primaria
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'msa_galicia' 
AND constraint_type = 'PRIMARY KEY';

-- 4. Verificar la nueva estructura de la tabla
SELECT 
    ordinal_position as posicion,
    column_name as columna,
    data_type as tipo,
    is_nullable as acepta_null,
    column_default as valor_default
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;

-- 5. Contar total de columnas (ahora debería ser 25)
SELECT 
    COUNT(*) as total_columnas,
    CASE 
        WHEN COUNT(*) = 25 THEN '✅ 25 COLUMNAS (24 + ID)'
        ELSE '❌ CANTIDAD INCORRECTA: ' || COUNT(*) || ' columnas'
    END as estado
FROM information_schema.columns 
WHERE table_name = 'msa_galicia';

-- 6. Verificar que la tabla sigue vacía
SELECT 
    COUNT(*) as total_registros,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ TABLA VACÍA'
        ELSE '❌ HAY ' || COUNT(*) || ' REGISTROS'
    END as estado_datos
FROM msa_galicia;

-- 7. Mensaje de confirmación
SELECT 'Clave primaria agregada exitosamente. Ahora puedes borrar filas desde Supabase.' as mensaje;
