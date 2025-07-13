-- Recrear completamente la tabla msa_galicia con las columnas exactas especificadas
-- ⚠️ ESTO BORRARÁ TODOS LOS DATOS EXISTENTES

-- 1. Eliminar la tabla completamente
DROP TABLE IF EXISTS msa_galicia CASCADE;

-- 2. Crear la tabla con las columnas exactas especificadas
CREATE TABLE msa_galicia (
    fecha DATE,
    descripcion TEXT,
    origen TEXT,
    debitos NUMERIC,
    creditos NUMERIC,
    grupo_de_conceptos TEXT,
    concepto TEXT,
    numero_de_terminal TEXT,
    observaciones_cliente TEXT,
    numero_de_comprobante TEXT,
    leyendas_adicionales_1 TEXT,
    leyendas_adicionales_2 TEXT,
    leyendas_adicionales_3 TEXT,
    leyendas_adicionales_4 TEXT,
    tipo_de_movimiento TEXT,
    saldo NUMERIC,
    control NUMERIC,
    categ TEXT,
    detalle TEXT,
    contable TEXT,
    interno TEXT,
    centro_de_costo TEXT,
    cuenta TEXT,
    orden NUMERIC
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
    is_nullable as acepta_null
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;

-- 7. Confirmar total de columnas
SELECT COUNT(*) as total_columnas 
FROM information_schema.columns 
WHERE table_name = 'msa_galicia';
