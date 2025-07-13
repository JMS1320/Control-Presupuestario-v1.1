-- Insertar datos en distribucion_socios UNA POR UNA en el orden correcto
-- Esto garantiza el orden de inserción

-- 1. DIST MA (Primera)
INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST MA', 'Distribucion Mama');

-- Pausa para asegurar orden temporal
SELECT pg_sleep(0.01);

-- 2. DIST MANU (Segunda)
INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST MANU', 'Distribucion Manuel');

-- Pausa para asegurar orden temporal
SELECT pg_sleep(0.01);

-- 3. DIST SOLE (Tercera)
INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST SOLE', 'Distribucion Soledad');

-- Pausa para asegurar orden temporal
SELECT pg_sleep(0.01);

-- 4. DIST MECHI (Cuarta)
INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST MECHI', 'Distribucion Mechi');

-- Pausa para asegurar orden temporal
SELECT pg_sleep(0.01);

-- 5. DIST AMS (Quinta)
INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST AMS', 'Distribucion Andres');

-- Pausa para asegurar orden temporal
SELECT pg_sleep(0.01);

-- 6. DIST JMS (Sexta - Última)
INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST JMS', 'Distribucion Jose');

-- Verificar el orden de inserción
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as orden_insercion,
    interno,
    concepto,
    created_at
FROM distribucion_socios 
ORDER BY created_at;

-- Contar total insertado
SELECT 
    COUNT(*) as total_registros,
    CASE 
        WHEN COUNT(*) = 6 THEN '✅ 6 REGISTROS INSERTADOS'
        ELSE '❌ CANTIDAD INCORRECTA'
    END as estado
FROM distribucion_socios;
