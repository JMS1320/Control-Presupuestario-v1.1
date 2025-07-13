-- Verificar que el orden final sea exactamente el esperado

-- 1. Mostrar orden final
SELECT '=== ORDEN FINAL ===' as titulo;
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as "#",
    interno,
    concepto,
    created_at::time as hora_insercion
FROM distribucion_socios 
ORDER BY created_at;

-- 2. Verificar orden específico
WITH orden_esperado AS (
    SELECT * FROM (VALUES
        (1, 'DIST MA', 'Distribucion Mama'),
        (2, 'DIST MANU', 'Distribucion Manuel'),
        (3, 'DIST SOLE', 'Distribucion Soledad'),
        (4, 'DIST MECHI', 'Distribucion Mechi'),
        (5, 'DIST AMS', 'Distribucion Andres'),
        (6, 'DIST JMS', 'Distribucion Jose')
    ) AS t(pos_esperada, interno_esperado, concepto_esperado)
),
orden_actual AS (
    SELECT 
        ROW_NUMBER() OVER (ORDER BY created_at) as pos_actual,
        interno,
        concepto
    FROM distribucion_socios
)
SELECT 
    e.pos_esperada as "#",
    e.interno_esperado as "Esperado",
    a.interno as "Actual",
    CASE 
        WHEN e.interno_esperado = a.interno 
        THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END as "Status"
FROM orden_esperado e
LEFT JOIN orden_actual a ON e.pos_esperada = a.pos_actual
ORDER BY e.pos_esperada;

-- 3. Resumen final
SELECT 
    COUNT(*) as total_registros,
    CASE 
        WHEN COUNT(*) = 6 THEN '✅ 6 REGISTROS COMPLETOS'
        ELSE '❌ CANTIDAD INCORRECTA'
    END as estado,
    (SELECT interno FROM distribucion_socios ORDER BY created_at LIMIT 1) as primero,
    (SELECT interno FROM distribucion_socios ORDER BY created_at DESC LIMIT 1) as ultimo
FROM distribucion_socios;
