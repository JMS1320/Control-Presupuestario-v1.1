-- Agregar columnas faltantes a la tabla msa_galicia
ALTER TABLE msa_galicia 
ADD COLUMN IF NOT EXISTS grupo_concepto TEXT,
ADD COLUMN IF NOT EXISTS concepto TEXT,
ADD COLUMN IF NOT EXISTS comprobante TEXT,
ADD COLUMN IF NOT EXISTS tipo_movimiento TEXT,
ADD COLUMN IF NOT EXISTS leyenda_1 TEXT,
ADD COLUMN IF NOT EXISTS leyenda_2 TEXT,
ADD COLUMN IF NOT EXISTS leyenda_3 TEXT,
ADD COLUMN IF NOT EXISTS leyenda_4 TEXT,
ADD COLUMN IF NOT EXISTS orden_banco INTEGER;

-- Actualizar el campo cuenta con valor fijo "MSA Galicia" para registros existentes
UPDATE msa_galicia 
SET cuenta = 'MSA Galicia' 
WHERE cuenta IS NULL OR cuenta != 'MSA Galicia';

-- Establecer valor por defecto para nuevos registros
ALTER TABLE msa_galicia 
ALTER COLUMN cuenta SET DEFAULT 'MSA Galicia';
