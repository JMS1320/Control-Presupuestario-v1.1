-- Verificar que la relación funciona correctamente y hay datos

-- 1. Verificar que la foreign key existe
SELECT 
    'Foreign Key Status' as verificacion,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'msa_galicia' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'msa_galicia_categ_fkey'
        ) THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as estado;

-- 2. Verificar datos en ambas tablas
SELECT 
    'Datos en cuentas_contables' as tabla,
    COUNT(*) as total_registros
FROM cuentas_contables
UNION ALL
SELECT 
    'Datos en msa_galicia' as tabla,
    COUNT(*) as total_registros
FROM msa_galicia;

-- 3. Probar el JOIN que usa el dashboard
SELECT 
    m.fecha,
    m.descripcion,
    m.categ,
    c.cuenta_contable,
    c.tipo,
    m.creditos,
    m.debitos
FROM msa_galicia m
JOIN cuentas_contables c ON m.categ = c.categ
ORDER BY m.fecha DESC
LIMIT 5;

-- 4. Verificar distribución por tipo de cuenta
SELECT 
    c.tipo,
    COUNT(*) as cantidad_movimientos,
    SUM(m.creditos) as total_creditos,
    SUM(m.debitos) as total_debitos
FROM msa_galicia m
JOIN cuentas_contables c ON m.categ = c.categ
GROUP BY c.tipo
ORDER BY c.tipo;

-- 5. Verificar si hay movimientos sin categoría válida
SELECT 
    'Movimientos con categ válido' as verificacion,
    COUNT(*) as cantidad
FROM msa_galicia m
JOIN cuentas_contables c ON m.categ = c.categ
UNION ALL
SELECT 
    'Movimientos con categ inválido' as verificacion,
    COUNT(*) as cantidad
FROM msa_galicia m
LEFT JOIN cuentas_contables c ON m.categ = c.categ
WHERE c.categ IS NULL AND m.categ IS NOT NULL;
