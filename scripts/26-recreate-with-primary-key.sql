-- Recrear la tabla con clave primaria como PRIMERA columna
-- Solo ejecutar si quieres que el ID esté al principio

-- 1. Eliminar la tabla actual (está vacía según confirmamos)
DROP TABLE IF EXISTS msa_galicia CASCADE;

-- 2. Crear la tabla con ID como primera columna
CREATE TABLE msa_galicia (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- PRIMERA COLUMNA
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

-- 3. Habilitar RLS
ALTER TABLE msa_galicia ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas
CREATE POLICY "Allow public read on msa_galicia" ON msa_galicia FOR SELECT USING (true);
CREATE POLICY "Allow public insert on msa_galicia" ON msa_galicia FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on msa_galicia" ON msa_galicia FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on msa_galicia" ON msa_galicia FOR DELETE USING (true);

-- 5. Verificar estructura final
SELECT 
    ordinal_position as posicion,
    column_name as columna,
    data_type as tipo,
    CASE 
        WHEN column_name = 'id' THEN '🔑 PRIMARY KEY'
        ELSE ''
    END as especial
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;

-- 6. Confirmar clave primaria
SELECT 'Tabla recreada con clave primaria. ID como primera columna.' as mensaje;
