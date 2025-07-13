-- Probar que el vínculo funciona correctamente

-- 1. Probar JOIN con orden correcto
SELECT 
    'JOIN con orden mantenido:' as titulo,
    d.orden,
    d.interno,
    d.concepto,
    COUNT(m.id) as movimientos_asociados
FROM distribucion_socios d
LEFT JOIN msa_galicia m ON d.interno = m.interno
GROUP BY d.orden, d.interno, d.concepto
ORDER BY d.orden; -- ¡Ahora usamos ORDER BY orden!

-- 2. Ejemplos de movimientos con distribución
SELECT 
    'Ejemplos de movimientos vinculados:' as titulo,
    m.fecha,
    m.descripcion,
    d.orden,
    d.interno,
    d.concepto,
    (m.creditos - m.debitos) as monto_neto
FROM msa_galicia m
INNER JOIN distribucion_socios d ON m.interno = d.interno
ORDER BY d.orden, m.fecha DESC
LIMIT 10;

-- 3. Resumen por distribución (ordenado correctamente)
SELECT 
    'Resumen por distribución (orden correcto):' as titulo,
    d.orden as "#",
    d.interno,
    d.concepto,
    COUNT(m.id) as total_movimientos,
    COALESCE(SUM(m.creditos), 0) as total_creditos,
    COALESCE(SUM(m.debitos), 0) as total_debitos,
    COALESCE(SUM(m.creditos - m.debitos), 0) as monto_neto
FROM distribucion_socios d
LEFT JOIN msa_galicia m ON d.interno = m.interno
GROUP BY d.orden, d.interno, d.concepto
ORDER BY d.orden;
