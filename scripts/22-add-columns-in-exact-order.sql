-- Agregar columnas UNA POR UNA en el orden EXACTO especificado
-- Esto garantiza el orden correcto de izquierda a derecha

-- 1. Fecha (primera columna)
ALTER TABLE msa_galicia ADD COLUMN fecha DATE;

-- 2. Descripción
ALTER TABLE msa_galicia ADD COLUMN descripcion TEXT;

-- 3. Origen
ALTER TABLE msa_galicia ADD COLUMN origen TEXT;

-- 4. Débitos
ALTER TABLE msa_galicia ADD COLUMN debitos NUMERIC;

-- 5. Créditos
ALTER TABLE msa_galicia ADD COLUMN creditos NUMERIC;

-- 6. Grupo de Conceptos
ALTER TABLE msa_galicia ADD COLUMN grupo_de_conceptos TEXT;

-- 7. Concepto
ALTER TABLE msa_galicia ADD COLUMN concepto TEXT;

-- 8. Número de Terminal
ALTER TABLE msa_galicia ADD COLUMN numero_de_terminal TEXT;

-- 9. Observaciones Cliente
ALTER TABLE msa_galicia ADD COLUMN observaciones_cliente TEXT;

-- 10. Número de Comprobante
ALTER TABLE msa_galicia ADD COLUMN numero_de_comprobante TEXT;

-- 11. Leyendas Adicionales 1
ALTER TABLE msa_galicia ADD COLUMN leyendas_adicionales_1 TEXT;

-- 12. Leyendas Adicionales 2
ALTER TABLE msa_galicia ADD COLUMN leyendas_adicionales_2 TEXT;

-- 13. Leyendas Adicionales 3
ALTER TABLE msa_galicia ADD COLUMN leyendas_adicionales_3 TEXT;

-- 14. Leyendas Adicionales 4
ALTER TABLE msa_galicia ADD COLUMN leyendas_adicionales_4 TEXT;

-- 15. Tipo de Movimiento
ALTER TABLE msa_galicia ADD COLUMN tipo_de_movimiento TEXT;

-- 16. Saldo
ALTER TABLE msa_galicia ADD COLUMN saldo NUMERIC;

-- 17. Control
ALTER TABLE msa_galicia ADD COLUMN control NUMERIC;

-- 18. CATEG
ALTER TABLE msa_galicia ADD COLUMN categ TEXT;

-- 19. Detalle
ALTER TABLE msa_galicia ADD COLUMN detalle TEXT;

-- 20. Contable
ALTER TABLE msa_galicia ADD COLUMN contable TEXT;

-- 21. Interno
ALTER TABLE msa_galicia ADD COLUMN interno TEXT;

-- 22. Centro de Costo
ALTER TABLE msa_galicia ADD COLUMN centro_de_costo TEXT;

-- 23. Cuenta
ALTER TABLE msa_galicia ADD COLUMN cuenta TEXT;

-- 24. Orden (última columna)
ALTER TABLE msa_galicia ADD COLUMN orden NUMERIC;

-- Verificar que se agregaron todas las columnas en orden
SELECT 
    ordinal_position as posicion,
    column_name as columna,
    data_type as tipo
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;

-- Contar total de columnas
SELECT 
    COUNT(*) as total_columnas,
    CASE 
        WHEN COUNT(*) = 24 THEN '✅ 24 COLUMNAS AGREGADAS'
        ELSE '❌ FALTAN COLUMNAS: ' || (24 - COUNT(*)) || ' restantes'
    END as estado
FROM information_schema.columns 
WHERE table_name = 'msa_galicia';
