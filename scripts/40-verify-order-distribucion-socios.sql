-- Verificar que el orden sea exactamente el esperado

-- 1. Mostrar orden actual vs orden esperado
WITH orden_esperado AS (
    SELECT * FROM (VALUES
        (1, 'DIST MA', 'Distribucion Mama'),
        (2, 'DIST MANU', 'Distribucion Manuel'),
        (3, 'DIST SOLE', 'Distribucion Soledad'),
        (4, 'DIST MECHI', 'Distribucion Mechi'),
        (5, 'DIST AMS', 'Distribucion Andres'),
        (6, 'DIST JMS', 'Distribucion Jose')
    ) AS t(orden_esperado, interno_esperado, concepto_esperado)
),
orden_actual AS (
    SELECT 
        ROW_NUMBER() OVER (ORDER BY created_at) as orden_actual,
        interno,
        concepto
    FROM distribucion_socios
)
SELECT 
    e.orden_esperado as "#",
    e.interno_esperado as "Interno Esperado",
    e.concepto_esperado as "Concepto Esperado",
    a.interno as "Interno Actual",
    a.concepto as "Concepto Actual",
    CASE 
        WHEN e.interno_esperado = a.interno AND e.concepto_esperado = a.concepto 
        THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END as "Status"
FROM orden_esperado e
LEFT JOIN orden_actual a ON e.orden_esperado = a.orden_actual
ORDER BY e.orden_esperado;

-- 2. Verificar que el primer registro sea DIST MA y el último DIST JMS
SELECT 
    'Primer registro' as verificacion,
    (SELECT interno FROM distribucion_socios ORDER BY created_at LIMIT 1) as valor,
    CASE 
        WHEN (SELECT interno FROM distribucion_socios ORDER BY created_at LIMIT 1) = 'DIST MA'
        THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END as estado
UNION ALL
SELECT 
    'Último registro' as verificacion,
    (SELECT interno FROM distribucion_socios ORDER BY created_at DESC LIMIT 1) as valor,
    CASE 
        WHEN (SELECT interno FROM distribucion_socios ORDER BY created_at DESC LIMIT 1) = 'DIST JMS'
        THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END as estado;

-- 3. Mostrar orden final para confirmación visual
SELECT '=== ORDEN FINAL CONFIRMADO ===' as titulo;
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as "#",
    interno,
    concepto,
    created_at::time as hora_insercion
FROM distribucion_socios 
ORDER BY created_at;
