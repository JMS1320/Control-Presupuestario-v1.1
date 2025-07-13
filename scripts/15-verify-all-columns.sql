-- Verificar que todas las columnas requeridas estén presentes

WITH required_columns AS (
    SELECT unnest(ARRAY[
        'fecha', 'descripcion', 'origen', 'debitos', 'creditos',
        'grupo_conceptos', 'concepto', 'nro_terminal', 'observaciones_cliente',
        'nro_comprobante', 'tipo_documento', 'codigo_banco', 'codigo_sucursal',
        'codigo_cajero', 'nro_control', 'nro_operacion', 'nro_autorizacion',
        'nro_lote', 'codigo_movimiento', 'tipo_movimiento', 'saldo', 'control',
        'categ', 'detalle', 'contable', 'interno', 'centro_costo', 'orden_banco', 'cuenta'
    ]) as required_column
),
existing_columns AS (
    SELECT column_name
    FROM information_schema.columns 
    WHERE table_name = 'msa_galicia'
)
SELECT 
    r.required_column,
    CASE 
        WHEN e.column_name IS NOT NULL THEN '✅ EXISTE'
        ELSE '❌ FALTA'
    END as status
FROM required_columns r
LEFT JOIN existing_columns e ON r.required_column = e.column_name
ORDER BY r.required_column;

-- Resumen
SELECT 
    COUNT(*) as total_columnas_requeridas,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'msa_galicia') as total_columnas_existentes
FROM (SELECT unnest(ARRAY[
    'fecha', 'descripcion', 'origen', 'debitos', 'creditos',
    'grupo_conceptos', 'concepto', 'nro_terminal', 'observaciones_cliente',
    'nro_comprobante', 'tipo_documento', 'codigo_banco', 'codigo_sucursal',
    'codigo_cajero', 'nro_control', 'nro_operacion', 'nro_autorizacion',
    'nro_lote', 'codigo_movimiento', 'tipo_movimiento', 'saldo', 'control',
    'categ', 'detalle', 'contable', 'interno', 'centro_costo', 'orden_banco', 'cuenta'
]) as col) t;
