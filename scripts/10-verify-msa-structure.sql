-- Verificar que la estructura de msa_galicia sea exactamente la requerida

-- 1. Verificar orden y tipos de columnas
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name IN ('fecha', 'debitos', 'creditos', 'saldo', 'orden_banco', 'categ', 'cuenta') 
        THEN 'NOT NULL REQUIRED'
        ELSE 'NULLABLE OK'
    END as nullability_status
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;

-- 2. Verificar que las columnas estén en el orden correcto
WITH expected_order AS (
    SELECT unnest(ARRAY[
        'fecha', 'descripcion', 'origen', 'debitos', 'creditos',
        'grupo_concepto', 'concepto', 'leyenda_2', 'leyenda_3', 'comprobante',
        'leyenda_1', 'leyenda_4', 'leyenda_5', 'leyenda_6', 'tipo_movimiento',
        'saldo', 'control', 'categ', 'detalle', 'contable',
        'interno', 'centro_costo', 'orden_banco', 'cuenta'
    ]) as expected_column,
    generate_series(1, 24) as expected_position
),
actual_order AS (
    SELECT column_name, ordinal_position
    FROM information_schema.columns 
    WHERE table_name = 'msa_galicia'
)
SELECT 
    e.expected_position,
    e.expected_column,
    a.column_name as actual_column,
    CASE 
        WHEN e.expected_column = a.column_name THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END as status
FROM expected_order e
LEFT JOIN actual_order a ON e.expected_position = a.ordinal_position
ORDER BY e.expected_position;

-- 3. Verificar datos existentes
SELECT 
    'Total registros' as metric,
    COUNT(*)::text as value
FROM msa_galicia
UNION ALL
SELECT 
    'Registros con categ válido',
    COUNT(*)::text
FROM msa_galicia m
WHERE EXISTS (SELECT 1 FROM cuentas_contables c WHERE c.categ = m.categ)
UNION ALL
SELECT 
    'Rango de fechas',
    CONCAT(MIN(fecha)::text, ' a ', MAX(fecha)::text)
FROM msa_galicia
UNION ALL
SELECT 
    'Rango orden_banco',
    CONCAT(MIN(orden_banco)::text, ' a ', MAX(orden_banco)::text)
FROM msa_galicia;
