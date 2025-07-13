-- Modificar estructura de la tabla msa_galicia
-- Asegurar que tenga exactamente las columnas especificadas en el orden correcto

-- Primero, crear una tabla temporal con la estructura exacta requerida
CREATE TABLE msa_galicia_new (
    fecha DATE NOT NULL,
    descripcion TEXT,
    origen TEXT,
    debitos NUMERIC NOT NULL,
    creditos NUMERIC NOT NULL,
    grupo_concepto TEXT,
    concepto TEXT,
    leyenda_2 TEXT, -- Número de Terminal
    leyenda_3 TEXT, -- Observaciones Cliente
    comprobante TEXT, -- Número de Comprobante
    leyenda_1 TEXT, -- Leyendas Adicionales1
    leyenda_4 TEXT, -- Leyendas Adicionales2
    leyenda_5 TEXT, -- Leyendas Adicionales3
    leyenda_6 TEXT, -- Leyendas Adicionales4
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

-- Migrar datos existentes de la tabla original a la nueva estructura
INSERT INTO msa_galicia_new (
    fecha,
    descripcion,
    origen,
    debitos,
    creditos,
    grupo_concepto,
    concepto,
    leyenda_2,
    leyenda_3,
    comprobante,
    leyenda_1,
    leyenda_4,
    leyenda_5,
    leyenda_6,
    tipo_movimiento,
    saldo,
    control,
    categ,
    detalle,
    contable,
    interno,
    centro_costo,
    orden_banco,
    cuenta
)
SELECT 
    fecha,
    COALESCE(descripcion, '') as descripcion,
    COALESCE(origen, '') as origen,
    COALESCE(debitos, 0) as debitos,
    COALESCE(creditos, 0) as creditos,
    COALESCE(grupo_concepto, '') as grupo_concepto,
    COALESCE(concepto, '') as concepto,
    COALESCE(leyenda_2, '') as leyenda_2,
    COALESCE(leyenda_3, '') as leyenda_3,
    COALESCE(comprobante, '') as comprobante,
    COALESCE(leyenda_1, '') as leyenda_1,
    COALESCE(leyenda_4, '') as leyenda_4,
    COALESCE(leyenda_5, '') as leyenda_5,
    COALESCE(leyenda_6, '') as leyenda_6,
    COALESCE(tipo_movimiento, '') as tipo_movimiento,
    COALESCE(saldo, 0) as saldo,
    COALESCE(control, 0) as control,
    COALESCE(categ, '') as categ,
    COALESCE(detalle, '') as detalle,
    COALESCE(contable, '') as contable,
    COALESCE(interno, '') as interno,
    COALESCE(centro_costo, '') as centro_costo,
    COALESCE(orden_banco, 1) as orden_banco,
    COALESCE(cuenta, 'MSA Galicia') as cuenta
FROM msa_galicia
WHERE fecha IS NOT NULL;

-- Eliminar la tabla original
DROP TABLE msa_galicia;

-- Renombrar la nueva tabla
ALTER TABLE msa_galicia_new RENAME TO msa_galicia;

-- Habilitar RLS en la nueva tabla
ALTER TABLE msa_galicia ENABLE ROW LEVEL SECURITY;

-- Crear política para permitir lectura pública
CREATE POLICY "Allow public read on msa_galicia" ON msa_galicia FOR SELECT USING (true);

-- Crear política para permitir inserción pública (para el importador)
CREATE POLICY "Allow public insert on msa_galicia" ON msa_galicia FOR INSERT WITH CHECK (true);

-- Verificar la estructura final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;

-- Mostrar un resumen de los datos migrados
SELECT 
    COUNT(*) as total_registros,
    MIN(fecha) as fecha_minima,
    MAX(fecha) as fecha_maxima,
    MIN(orden_banco) as orden_minimo,
    MAX(orden_banco) as orden_maximo
FROM msa_galicia;
