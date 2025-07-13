-- Probar que el JOIN funciona correctamente después de recrear todo

-- 1. Probar JOIN básico
SELECT 
    'Prueba de JOIN básico' as test,
    COUNT(*) as movimientos_con_distribucion
FROM msa_galicia m
INNER JOIN distribucion_socios d ON m.interno = d.interno;

-- 2. Mostrar ejemplos del JOIN funcionando
SELECT 
    'Ejemplos de JOIN funcionando:' as titulo,
    m.fecha,
    m.descripcion,
    m.interno,
    d.concepto as distribucion_concepto,
    m.creditos - m.debitos as monto_neto
FROM msa_galicia m
INNER JOIN distribucion_socios d ON m.interno = d.interno
ORDER BY m.fecha DESC
LIMIT 10;

-- 3. Resumen por distribución (agrupado)
SELECT 
    'Resumen por distribución:' as titulo,
    d.interno,
    d.concepto,
    COUNT(*) as cantidad_movimientos,
    SUM(m.creditos) as total_creditos,
    SUM(m.debitos) as total_debitos,
    SUM(m.creditos - m.debitos) as monto_neto
FROM distribucion_socios d
LEFT JOIN msa_galicia m ON d.interno = m.interno
GROUP BY d.interno, d.concepto
ORDER BY d.created_at; -- Esto mantendrá el orden de inserción

-- 4. Verificar que el orden se mantiene en los JOINs
SELECT 
    'Orden mantenido en JOINs:' as titulo,
    ROW_NUMBER() OVER (ORDER BY d.created_at) as orden,
    d.interno,
    d.concepto,
    COUNT(m.id) as movimientos_asociados
FROM distribucion_socios d
LEFT JOIN msa_galicia m ON d.interno = m.interno
GROUP BY d.interno, d.concepto, d.created_at
ORDER BY d.created_at;
