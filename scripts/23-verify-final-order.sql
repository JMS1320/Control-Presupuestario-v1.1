-- Verificación FINAL del orden exacto de columnas

-- 1. Mostrar orden actual vs orden esperado
WITH orden_esperado AS (
    SELECT * FROM (VALUES
        (1, 'fecha', 'Fecha'),
        (2, 'descripcion', 'Descripción'),
        (3, 'origen', 'Origen'),
        (4, 'debitos', 'Débitos'),
        (5, 'creditos', 'Créditos'),
        (6, 'grupo_de_conceptos', 'Grupo de Conceptos'),
        (7, 'concepto', 'Concepto'),
        (8, 'numero_de_terminal', 'Número de Terminal'),
        (9, 'observaciones_cliente', 'Observaciones Cliente'),
        (10, 'numero_de_comprobante', 'Número de Comprobante'),
        (11, 'leyendas_adicionales_1', 'Leyendas Adicionales 1'),
        (12, 'leyendas_adicionales_2', 'Leyendas Adicionales 2'),
        (13, 'leyendas_adicionales_3', 'Leyendas Adicionales 3'),
        (14, 'leyendas_adicionales_4', 'Leyendas Adicionales 4'),
        (15, 'tipo_de_movimiento', 'Tipo de Movimiento'),
        (16, 'saldo', 'Saldo'),
        (17, 'control', 'Control'),
        (18, 'categ', 'CATEG'),
        (19, 'detalle', 'Detalle'),
        (20, 'contable', 'Contable'),
        (21, 'interno', 'Interno'),
        (22, 'centro_de_costo', 'Centro de Costo'),
        (23, 'cuenta', 'Cuenta'),
        (24, 'orden', 'Orden')
    ) AS t(pos_esperada, col_esperada, nombre_excel)
),
orden_actual AS (
    SELECT 
        ordinal_position,
        column_name
    FROM information_schema.columns 
    WHERE table_name = 'msa_galicia'
)
SELECT 
    e.pos_esperada as "#",
    e.nombre_excel as "Columna Excel",
    e.col_esperada as "Esperado",
    a.column_name as "Actual",
    CASE 
        WHEN e.col_esperada = a.column_name THEN '✅'
        ELSE '❌'
    END as "OK"
FROM orden_esperado e
LEFT JOIN orden_actual a ON e.pos_esperada = a.ordinal_position
ORDER BY e.pos_esperada;

-- 2. Resumen final
SELECT '=== RESUMEN FINAL ===' as titulo;

SELECT 
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'msa_galicia') as total_columnas,
    (SELECT COUNT(*) FROM msa_galicia) as total_registros,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'msa_galicia') = 24 
        THEN '✅ ESTRUCTURA CORRECTA'
        ELSE '❌ ESTRUCTURA INCORRECTA'
    END as estado_estructura;

-- 3. Verificar que el primer campo sea 'fecha' y el último 'orden'
SELECT 
    'Primera columna' as verificacion,
    (SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'msa_galicia' AND ordinal_position = 1) as valor,
    CASE 
        WHEN (SELECT column_name FROM information_schema.columns 
              WHERE table_name = 'msa_galicia' AND ordinal_position = 1) = 'fecha'
        THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END as estado
UNION ALL
SELECT 
    'Última columna' as verificacion,
    (SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'msa_galicia' AND ordinal_position = 24) as valor,
    CASE 
        WHEN (SELECT column_name FROM information_schema.columns 
              WHERE table_name = 'msa_galicia' AND ordinal_position = 24) = 'orden'
        THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END as estado;
