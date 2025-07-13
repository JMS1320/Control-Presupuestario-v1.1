-- Verificar que la estructura de msa_galicia sea exactamente la especificada

-- 1. Verificar orden exacto de columnas
WITH expected_structure AS (
    SELECT * FROM (VALUES
        (1, 'fecha', 'date'),
        (2, 'descripcion', 'text'),
        (3, 'origen', 'text'),
        (4, 'debitos', 'numeric'),
        (5, 'creditos', 'numeric'),
        (6, 'grupo_de_conceptos', 'text'),
        (7, 'concepto', 'text'),
        (8, 'numero_de_terminal', 'text'),
        (9, 'observaciones_cliente', 'text'),
        (10, 'numero_de_comprobante', 'text'),
        (11, 'leyendas_adicionales_1', 'text'),
        (12, 'leyendas_adicionales_2', 'text'),
        (13, 'leyendas_adicionales_3', 'text'),
        (14, 'leyendas_adicionales_4', 'text'),
        (15, 'tipo_de_movimiento', 'text'),
        (16, 'saldo', 'numeric'),
        (17, 'control', 'numeric'),
        (18, 'categ', 'text'),
        (19, 'detalle', 'text'),
        (20, 'contable', 'text'),
        (21, 'interno', 'text'),
        (22, 'centro_de_costo', 'text'),
        (23, 'cuenta', 'text'),
        (24, 'orden', 'numeric')
    ) AS t(pos, col, tipo)
),
actual_structure AS (
    SELECT 
        ordinal_position,
        column_name,
        data_type
    FROM information_schema.columns 
    WHERE table_name = 'msa_galicia'
)
SELECT 
    e.pos as posicion_esperada,
    e.col as columna_esperada,
    e.tipo as tipo_esperado,
    a.column_name as columna_actual,
    a.data_type as tipo_actual,
    CASE 
        WHEN e.col = a.column_name AND e.tipo = a.data_type 
        THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END as status
FROM expected_structure e
LEFT JOIN actual_structure a ON e.pos = a.ordinal_position
ORDER BY e.pos;

-- 2. Verificar que la tabla esté vacía
SELECT 
    'Registros en la tabla' as verificacion,
    COUNT(*)::text as resultado,
    CASE WHEN COUNT(*) = 0 THEN '✅ TABLA VACÍA' ELSE '❌ TABLA CON DATOS' END as status
FROM msa_galicia;

-- 3. Verificar total de columnas
SELECT 
    'Total de columnas' as verificacion,
    COUNT(*)::text as resultado,
    CASE WHEN COUNT(*) = 24 THEN '✅ 24 COLUMNAS' ELSE '❌ CANTIDAD INCORRECTA' END as status
FROM information_schema.columns 
WHERE table_name = 'msa_galicia';

-- 4. Listar todas las columnas en orden
SELECT '=== ESTRUCTURA FINAL ===' as titulo;
SELECT 
    ordinal_position as "#",
    column_name as "Columna",
    data_type as "Tipo",
    is_nullable as "Null"
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;
