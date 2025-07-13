-- Renombrar la tabla categorias_interno a distribucion_socios
-- Los vínculos y constraints se mantienen automáticamente

-- 1. Renombrar la tabla
ALTER TABLE categorias_interno RENAME TO distribucion_socios;

-- 2. Verificar que el cambio se aplicó correctamente
SELECT 
    'Tabla renombrada exitosamente' as mensaje,
    table_name as nombre_actual
FROM information_schema.tables 
WHERE table_name = 'distribucion_socios';

-- 3. Verificar que los datos se mantuvieron
SELECT 
    COUNT(*) as total_registros,
    'registros preservados' as estado
FROM distribucion_socios;

-- 4. Mostrar los datos para confirmar
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as "#",
    interno,
    concepto
FROM distribucion_socios 
ORDER BY created_at;
