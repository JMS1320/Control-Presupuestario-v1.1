-- Script alternativo para forzar el orden exacto de columnas
-- Solo ejecutar si el orden anterior no funcionó

-- Método alternativo: Crear tabla temporal y copiar en orden específico
DO $$
BEGIN
    -- Verificar si necesitamos reordenar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'msa_galicia' 
        AND ordinal_position = 1 
        AND column_name != 'fecha'
    ) THEN
        
        -- Crear tabla temporal con orden correcto
        CREATE TABLE msa_galicia_ordered (
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
        
        -- Copiar datos si existen
        INSERT INTO msa_galicia_ordered 
        SELECT 
            fecha, descripcion, origen, debitos, creditos,
            grupo_de_conceptos, concepto, numero_de_terminal, 
            observaciones_cliente, numero_de_comprobante,
            leyendas_adicionales_1, leyendas_adicionales_2,
            leyendas_adicionales_3, leyendas_adicionales_4,
            tipo_de_movimiento, saldo, control, categ,
            detalle, contable, interno, centro_de_costo,
            cuenta, orden
        FROM msa_galicia;
        
        -- Eliminar tabla original
        DROP TABLE msa_galicia CASCADE;
        
        -- Renombrar tabla ordenada
        ALTER TABLE msa_galicia_ordered RENAME TO msa_galicia;
        
        -- Reconfigurar RLS
        ALTER TABLE msa_galicia ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow public read on msa_galicia" ON msa_galicia FOR SELECT USING (true);
        CREATE POLICY "Allow public insert on msa_galicia" ON msa_galicia FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow public update on msa_galicia" ON msa_galicia FOR UPDATE USING (true);
        CREATE POLICY "Allow public delete on msa_galicia" ON msa_galicia FOR DELETE USING (true);
        
        RAISE NOTICE 'Tabla reordenada exitosamente';
    ELSE
        RAISE NOTICE 'El orden de columnas ya es correcto';
    END IF;
END $$;

-- Verificar orden final
SELECT 
    ordinal_position as posicion,
    column_name as columna
FROM information_schema.columns 
WHERE table_name = 'msa_galicia' 
ORDER BY ordinal_position;
