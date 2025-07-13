-- ESTRATEGIA PARA FUTURO: Agregar columna de orden explícita
-- Esto garantiza que Supabase respete el orden que queremos

-- 1. Agregar columna de orden
ALTER TABLE distribucion_socios 
ADD COLUMN orden INTEGER;

-- 2. Actualizar con el orden actual (basado en created_at)
UPDATE distribucion_socios 
SET orden = subquery.row_num
FROM (
    SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY created_at) as row_num
    FROM distribucion_socios
) subquery
WHERE distribucion_socios.id = subquery.id;

-- 3. Hacer que la columna orden sea NOT NULL
ALTER TABLE distribucion_socios 
ALTER COLUMN orden SET NOT NULL;

-- 4. Crear índice para mejor performance
CREATE INDEX idx_distribucion_socios_orden ON distribucion_socios(orden);

-- 5. Verificar el resultado
SELECT 
    orden,
    interno,
    concepto,
    created_at
FROM distribucion_socios 
ORDER BY orden;

-- Mensaje explicativo
SELECT 'Columna orden agregada. Ahora usa ORDER BY orden para garantizar el orden.' as tip;
