-- Verificar todos los movimientos de categoría MANT
SELECT 
    fecha,
    descripcion,
    debitos,
    creditos,
    saldo,
    EXTRACT(MONTH FROM fecha) as mes,
    EXTRACT(YEAR FROM fecha) as año,
    orden
FROM msa_galicia 
WHERE categ = 'MANT'
ORDER BY fecha, orden;

-- Contar movimientos MANT por mes
SELECT 
    EXTRACT(YEAR FROM fecha) as año,
    EXTRACT(MONTH FROM fecha) as mes,
    COUNT(*) as cantidad_movimientos,
    SUM(debitos) as total_debitos,
    SUM(creditos) as total_creditos,
    SUM(creditos - debitos) as monto_neto
FROM msa_galicia 
WHERE categ = 'MANT'
GROUP BY EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha)
ORDER BY año, mes;

-- Verificar si hay problemas de zona horaria
SELECT 
    fecha,
    fecha::timestamp as fecha_timestamp,
    fecha AT TIME ZONE 'UTC' as fecha_utc,
    descripcion
FROM msa_galicia 
WHERE categ = 'MANT'
ORDER BY fecha;
