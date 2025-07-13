-- ⚠️ REINICIAR COMPLETAMENTE LA TABLA msa_galicia
-- Este script borra toda la estructura y datos existentes

-- 1. Eliminar la tabla completamente si existe
DROP TABLE IF EXISTS msa_galicia CASCADE;

-- 2. Crear la tabla desde cero con la estructura exacta requerida
CREATE TABLE msa_galicia (
    fecha DATE NOT NULL,
    descripcion TEXT,
    origen TEXT,
    debitos NUMERIC NOT NULL,
    creditos NUMERIC NOT NULL,
    grupo_concepto TEXT,
    concepto TEXT,
    leyenda_2 TEXT,
    leyenda_3 TEXT,
    comprobante TEXT,
    leyenda_1 TEXT,
    leyenda_4 TEXT,
    leyenda_5 TEXT,
    leyenda_6 TEXT,
    tipo_movimiento TEXT,
    saldo NUMERIC NOT NULL,
    control NUMERIC,
    categ TEXT NOT NULL,
    detalle TEXT,
    contable TEXT,
    interno TEXT,
    centro_costo TEXT,
    orden_banco INTEGER NOT NULL,
    cuenta TEXT NOT NULL
);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE msa_galicia ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas básicas para permitir operaciones
CREATE POLICY "Allow public read on msa_galicia" ON msa_galicia FOR SELECT USING (true);
CREATE POLICY "Allow public insert on msa_galicia" ON msa_galicia FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on msa_galicia" ON msa_galicia FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on msa_galicia" ON msa_galicia FOR DELETE USING (true);

-- 5. Verificar que la tabla esté vacía
SELECT COUNT(*) as total_registros FROM msa_galicia;

-- 6. Mostrar la estructura final de la tabla
SELECT 
    ordinal_position as posicion,
    column_name as columna,
    data_type as tipo,
    CASE 
        WHEN is_nullable = 'YES' THEN 'NULL'
        ELSE 'NOT NULL'
    END as nulabilidad
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;

-- 7. Confirmar que no hay claves primarias ni constraints especiales
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'msa_galicia'
AND constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK');
