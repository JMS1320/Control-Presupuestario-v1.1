-- Borrar SOLO los datos de la tabla msa_galicia
-- Mantener la estructura de columnas intacta

-- 1. Eliminar todos los registros
DELETE FROM msa_galicia;

-- 2. Verificar que la tabla esté vacía
SELECT 
    COUNT(*) as registros_restantes,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ TABLA VACÍA'
        ELSE '❌ AÚN HAY ' || COUNT(*) || ' REGISTROS'
    END as estado_datos
FROM msa_galicia;

-- 3. Verificar que las columnas se mantuvieron
SELECT 
    COUNT(*) as total_columnas,
    CASE 
        WHEN COUNT(*) = 24 THEN '✅ ESTRUCTURA PRESERVADA (24 COLUMNAS)'
        ELSE '❌ ESTRUCTURA ALTERADA (' || COUNT(*) || ' COLUMNAS)'
    END as estado_estructura
FROM information_schema.columns 
WHERE table_name = 'msa_galicia';

-- 4. Mostrar las primeras 5 columnas para confirmar que están bien
SELECT 
    ordinal_position as posicion,
    column_name as columna,
    data_type as tipo
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
AND ordinal_position <= 5
ORDER BY ordinal_position;

-- 5. Mostrar las últimas 5 columnas para confirmar que están bien
SELECT 
    ordinal_position as posicion,
    column_name as columna,
    data_type as tipo
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
AND ordinal_position >= 20
ORDER BY ordinal_position;

-- 6. Mensaje de confirmación
SELECT 'Datos eliminados exitosamente. Estructura de columnas preservada.' as mensaje;
