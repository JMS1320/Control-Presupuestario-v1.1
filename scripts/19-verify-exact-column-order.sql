-- Verificar que las columnas estén en el orden EXACTO especificado

-- 1. Verificar orden exacto posición por posición
WITH expected_order AS (
    SELECT * FROM (VALUES
        (1, 'fecha', 'date', 'Fecha'),
        (2, 'descripcion', 'text', 'Descripción'),
        (3, 'origen', 'text', 'Origen'),
        (4, 'debitos', 'numeric', 'Débitos'),
        (5, 'creditos', 'numeric', 'Créditos'),
        (6, 'grupo_de_conceptos', 'text', 'Grupo de Conceptos'),
        (7, 'concepto', 'text', 'Concepto'),
        (8, 'numero_de_terminal', 'text', 'Número de Terminal'),
        (9, 'observaciones_cliente', 'text', 'Observaciones Cliente'),
        (10, 'numero_de_comprobante', 'text', 'Número de Comprobante'),
        (11, 'leyendas_adicionales_1', 'text', 'Leyendas Adicionales 1'),
        (12, 'leyendas_adicionales_2', 'text', 'Leyendas Adicionales 2'),
        (13, 'leyendas_adicionales_3', 'text', 'Leyendas Adicionales 3'),
        (14, 'leyendas_adicionales_4', 'text', 'Leyendas Adicionales 4'),
        (15, 'tipo_de_movimiento', 'text', 'Tipo de Movimiento'),
        (16, 'saldo', 'numeric', 'Saldo'),
        (17, 'control', 'numeric', 'Control'),
        (18, 'categ', 'text', 'CATEG'),
        (19, 'detalle', 'text', 'Detalle'),
        (20, 'contable', 'text', 'Contable'),
        (21, 'interno', 'text', 'Interno'),
        (22, 'centro_de_costo', 'text', 'Centro de Costo'),
        (23, 'cuenta', 'text', 'Cuenta'),
        (24, 'orden', 'numeric', 'Orden')
    ) AS t(pos_esperada, col_esperada, tipo_esperado, nombre_original)
),
actual_order AS (
    SELECT 
        ordinal_position,
        column_name,
        data_type
    FROM information_schema.columns 
    WHERE table_name = 'msa_galicia'
)
SELECT 
    e.pos_esperada as "Pos",
    e.nombre_original as "Columna Original",
    e.col_esperada as "Nombre BD",
    e.tipo_esperado as "Tipo Esperado",
    a.column_name as "Nombre Actual",
    a.data_type as "Tipo Actual",
    CASE 
        WHEN e.col_esperada = a.column_name AND e.tipo_esperado = a.data_type 
        THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END as "Status"
FROM expected_order e
LEFT JOIN actual_order a ON e.pos_esperada = a.ordinal_position
ORDER BY e.pos_esperada;

-- 2. Resumen de verificación
SELECT '=== RESUMEN DE VERIFICACIÓN ===' as titulo;

SELECT 
    CASE 
        WHEN COUNT(*) = 24 THEN '✅ CORRECTO: 24 columnas'
        ELSE '❌ INCORRECTO: ' || COUNT(*) || ' columnas'
    END as total_columnas
FROM information_schema.columns 
WHERE table_name = 'msa_galicia';

-- 3. Verificar que la tabla esté vacía
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ TABLA VACÍA'
        ELSE '❌ TABLA CON ' || COUNT(*) || ' REGISTROS'
    END as estado_datos
FROM msa_galicia;

-- 4. Mostrar orden final para confirmación visual
SELECT '=== ORDEN FINAL DE COLUMNAS ===' as titulo;
SELECT 
    ordinal_position as "#",
    column_name as "Columna en BD",
    data_type as "Tipo"
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;
