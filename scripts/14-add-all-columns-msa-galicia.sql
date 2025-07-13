-- Agregar todas las columnas necesarias a la tabla msa_galicia
-- Solo se agregan las columnas que no existen

DO $$ 
BEGIN
    -- fecha
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'fecha') THEN
        ALTER TABLE msa_galicia ADD COLUMN fecha DATE;
    END IF;
    
    -- descripcion
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'descripcion') THEN
        ALTER TABLE msa_galicia ADD COLUMN descripcion TEXT;
    END IF;
    
    -- origen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'origen') THEN
        ALTER TABLE msa_galicia ADD COLUMN origen TEXT;
    END IF;
    
    -- debitos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'debitos') THEN
        ALTER TABLE msa_galicia ADD COLUMN debitos NUMERIC;
    END IF;
    
    -- creditos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'creditos') THEN
        ALTER TABLE msa_galicia ADD COLUMN creditos NUMERIC;
    END IF;
    
    -- grupo_conceptos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'grupo_conceptos') THEN
        ALTER TABLE msa_galicia ADD COLUMN grupo_conceptos TEXT;
    END IF;
    
    -- concepto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'concepto') THEN
        ALTER TABLE msa_galicia ADD COLUMN concepto TEXT;
    END IF;
    
    -- nro_terminal
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'nro_terminal') THEN
        ALTER TABLE msa_galicia ADD COLUMN nro_terminal TEXT;
    END IF;
    
    -- observaciones_cliente
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'observaciones_cliente') THEN
        ALTER TABLE msa_galicia ADD COLUMN observaciones_cliente TEXT;
    END IF;
    
    -- nro_comprobante
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'nro_comprobante') THEN
        ALTER TABLE msa_galicia ADD COLUMN nro_comprobante TEXT;
    END IF;
    
    -- tipo_documento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'tipo_documento') THEN
        ALTER TABLE msa_galicia ADD COLUMN tipo_documento TEXT;
    END IF;
    
    -- codigo_banco
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'codigo_banco') THEN
        ALTER TABLE msa_galicia ADD COLUMN codigo_banco TEXT;
    END IF;
    
    -- codigo_sucursal
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'codigo_sucursal') THEN
        ALTER TABLE msa_galicia ADD COLUMN codigo_sucursal TEXT;
    END IF;
    
    -- codigo_cajero
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'codigo_cajero') THEN
        ALTER TABLE msa_galicia ADD COLUMN codigo_cajero TEXT;
    END IF;
    
    -- nro_control
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'nro_control') THEN
        ALTER TABLE msa_galicia ADD COLUMN nro_control TEXT;
    END IF;
    
    -- nro_operacion
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'nro_operacion') THEN
        ALTER TABLE msa_galicia ADD COLUMN nro_operacion TEXT;
    END IF;
    
    -- nro_autorizacion
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'nro_autorizacion') THEN
        ALTER TABLE msa_galicia ADD COLUMN nro_autorizacion TEXT;
    END IF;
    
    -- nro_lote
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'nro_lote') THEN
        ALTER TABLE msa_galicia ADD COLUMN nro_lote TEXT;
    END IF;
    
    -- codigo_movimiento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'codigo_movimiento') THEN
        ALTER TABLE msa_galicia ADD COLUMN codigo_movimiento TEXT;
    END IF;
    
    -- tipo_movimiento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'tipo_movimiento') THEN
        ALTER TABLE msa_galicia ADD COLUMN tipo_movimiento TEXT;
    END IF;
    
    -- saldo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'saldo') THEN
        ALTER TABLE msa_galicia ADD COLUMN saldo NUMERIC;
    END IF;
    
    -- control
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'control') THEN
        ALTER TABLE msa_galicia ADD COLUMN control NUMERIC;
    END IF;
    
    -- categ
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'categ') THEN
        ALTER TABLE msa_galicia ADD COLUMN categ TEXT;
    END IF;
    
    -- detalle
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'detalle') THEN
        ALTER TABLE msa_galicia ADD COLUMN detalle TEXT;
    END IF;
    
    -- contable
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'contable') THEN
        ALTER TABLE msa_galicia ADD COLUMN contable TEXT;
    END IF;
    
    -- interno
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'interno') THEN
        ALTER TABLE msa_galicia ADD COLUMN interno TEXT;
    END IF;
    
    -- centro_costo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'centro_costo') THEN
        ALTER TABLE msa_galicia ADD COLUMN centro_costo TEXT;
    END IF;
    
    -- orden_banco (si no existe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'orden_banco') THEN
        ALTER TABLE msa_galicia ADD COLUMN orden_banco INTEGER;
    END IF;
    
    -- cuenta (si no existe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'msa_galicia' AND column_name = 'cuenta') THEN
        ALTER TABLE msa_galicia ADD COLUMN cuenta TEXT;
    END IF;

END $$;

-- Verificar todas las columnas agregadas
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;

-- Contar total de columnas
SELECT COUNT(*) as total_columnas FROM information_schema.columns 
WHERE table_name = 'msa_galicia';
