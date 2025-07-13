-- Insertar datos en la tabla categorias_interno UNA POR UNA
-- Manteniendo el orden especificado

-- 1. DIST MA
INSERT INTO categorias_interno (interno, concepto) 
VALUES ('DIST MA', 'Distribucion Mama');

-- 2. DIST MANU
INSERT INTO categorias_interno (interno, concepto) 
VALUES ('DIST MANU', 'Distribucion Manuel');

-- 3. DIST SOLE
INSERT INTO categorias_interno (interno, concepto) 
VALUES ('DIST SOLE', 'Distribucion Soledad');

-- 4. DIST MECHI
INSERT INTO categorias_interno (interno, concepto) 
VALUES ('DIST MECHI', 'Distribucion Mechi');

-- 5. DIST AMS
INSERT INTO categorias_interno (interno, concepto) 
VALUES ('DIST AMS', 'Distribucion Andres');

-- 6. DIST JMS
INSERT INTO categorias_interno (interno, concepto) 
VALUES ('DIST JMS', 'Distribucion Jose');

-- Verificar que se insertaron todos los registros
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as orden,
    interno,
    concepto,
    created_at
FROM categorias_interno 
ORDER BY created_at;

-- Contar total de registros
SELECT 
    COUNT(*) as total_registros,
    'registros insertados exitosamente' as estado
FROM categorias_interno;
