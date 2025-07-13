-- Borrar todos los datos de la tabla msa_galicia
-- Mantener la estructura de la tabla intacta

DELETE FROM msa_galicia;

-- Verificar que la tabla esté vacía
SELECT COUNT(*) as registros_restantes FROM msa_galicia;

-- Mostrar confirmación
SELECT 'Tabla msa_galicia limpiada exitosamente' as mensaje;

-- Verificar que la estructura se mantenga intacta
SELECT 
    COUNT(*) as total_columnas,
    'Estructura preservada' as estado
FROM information_schema.columns 
WHERE table_name = 'msa_galicia';
