-- Verificar que la estructura de msa_galicia sea exactamente la requerida

-- 1. Verificar orden exacto de columnas
WITH expected_structure AS (
    SELECT * FROM (VALUES
        (1, 'fecha', 'date', 'NOT NULL'),
        (2, 'descripcion', 'text', 'NULL'),
        (3, 'origen', 'text', 'NULL'),
        (4, 'debitos', 'numeric', 'NOT NULL'),
        (5, 'creditos', 'numeric', 'NOT NULL'),
        (6, 'grupo_concepto', 'text', 'NULL'),
        (7, 'concepto', 'text', 'NULL'),
        (8, 'leyenda_2', 'text', 'NULL'),
        (9, 'leyenda_3', 'text', 'NULL'),
        (10, 'comprobante', 'text', 'NULL'),
        (11, 'leyenda_1', 'text', 'NULL'),
        (12, 'leyenda_4', 'text', 'NULL'),
        (13, 'leyenda_5', 'text', 'NULL'),
        (14, 'leyenda_6', 'text', 'NULL'),
        (15, 'tipo_movimiento', 'text', 'NULL'),
        (16, 'saldo', 'numeric', 'NOT NULL'),
        (17, 'control', 'numeric', 'NULL'),
        (18, 'categ', 'text', 'NOT NULL'),
        (19, 'detalle', 'text', 'NULL'),
        (20, 'contable', 'text', 'NULL'),
        (21, 'interno', 'text', 'NULL'),
        (22, 'centro_costo', 'text', 'NULL'),
        (23, 'orden_banco', 'integer', 'NOT NULL'),
        (24, 'cuenta', 'text', 'NOT NULL')
    ) AS t(pos, col, tipo, nulabilidad)
),
actual_structure AS (
    SELECT 
        ordinal_position,
        column_name,
        data_type,
        CASE WHEN is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END as nulabilidad
    FROM information_schema.columns 
    WHERE table_name = 'msa_galicia'
)
SELECT 
    e.pos as posicion_esperada,
    e.col as columna_esperada,
    e.tipo as tipo_esperado,
    e.nulabilidad as nulabilidad_esperada,
    a.column_name as columna_actual,
    a.data_type as tipo_actual,
    a.nulabilidad as nulabilidad_actual,
    CASE 
        WHEN e.col = a.column_name AND e.tipo = a.data_type AND e.nulabilidad = a.nulabilidad 
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

-- 3. Verificar que no hay claves primarias ni constraints
SELECT 
    'Constraints especiales' as verificacion,
    COUNT(*)::text as resultado,
    CASE WHEN COUNT(*) = 0 THEN '✅ SIN CONSTRAINTS' ELSE '❌ HAY CONSTRAINTS' END as status
FROM information_schema.table_constraints 
WHERE table_name = 'msa_galicia'
AND constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK');

-- 4. Verificar políticas RLS
SELECT 
    'Políticas RLS' as verificacion,
    COUNT(*)::text as resultado,
    CASE WHEN COUNT(*) > 0 THEN '✅ RLS CONFIGURADO' ELSE '❌ SIN RLS' END as status
FROM pg_policies 
WHERE tablename = 'msa_galicia';

-- 5. Resumen final
SELECT '=== RESUMEN FINAL ===' as titulo;
SELECT 
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'msa_galicia') as total_columnas,
    (SELECT COUNT(*) FROM msa_galicia) as total_registros,
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE table_name = 'msa_galicia' AND constraint_type = 'PRIMARY KEY') as claves_primarias,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'msa_galicia') as politicas_rls;
