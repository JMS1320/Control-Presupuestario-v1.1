-- Agregar columna "seccion" a la tabla distribucion_socios

-- 1. Agregar la columna seccion
ALTER TABLE distribucion_socios 
ADD COLUMN seccion INTEGER;

-- 2. Actualizar todas las filas existentes con seccion = 1
UPDATE distribucion_socios 
SET seccion = 1;

-- 3. Hacer que la columna seccion sea NOT NULL
ALTER TABLE distribucion_socios 
ALTER COLUMN seccion SET NOT NULL;

-- 4. Verificar la estructura actualizada
SELECT 
    ordinal_position as posicion,
    column_name as columna,
    data_type as tipo,
    is_nullable as acepta_null
FROM information_schema.columns 
WHERE table_name = 'distribucion_socios' 
ORDER BY ordinal_position;

-- 5. Mostrar datos actualizados
SELECT 
    orden,
    interno,
    concepto,
    seccion,
    created_at
FROM distribucion_socios 
ORDER BY orden;

-- Mensaje de confirmación
SELECT 'Columna seccion agregada. Todas las filas existentes tienen seccion = 1' as mensaje;
