-- Recrear completamente la tabla msa_galicia con el orden EXACTO de columnas
-- ⚠️ ESTO BORRARÁ TODOS LOS DATOS EXISTENTES

-- 1. Eliminar la tabla completamente
DROP TABLE IF EXISTS msa_galicia CASCADE;

-- 2. Crear la tabla con las columnas en el orden EXACTO especificado
-- El orden de creación determina el orden visual en Supabase
CREATE TABLE msa_galicia (
    fecha DATE,                          -- 1. Fecha
    descripcion TEXT,                    -- 2. Descripción  
    origen TEXT,                         -- 3. Origen
    debitos NUMERIC,                     -- 4. Débitos
    creditos NUMERIC,                    -- 5. Créditos
    grupo_de_conceptos TEXT,             -- 6. Grupo de Conceptos
    concepto TEXT,                       -- 7. Concepto
    numero_de_terminal TEXT,             -- 8. Número de Terminal
    observaciones_cliente TEXT,          -- 9. Observaciones Cliente
    numero_de_comprobante TEXT,          -- 10. Número de Comprobante
    leyendas_adicionales_1 TEXT,         -- 11. Leyendas Adicionales 1
    leyendas_adicionales_2 TEXT,         -- 12. Leyendas Adicionales 2
    leyendas_adicionales_3 TEXT,         -- 13. Leyendas Adicionales 3
    leyendas_adicionales_4 TEXT,         -- 14. Leyendas Adicionales 4
    tipo_de_movimiento TEXT,             -- 15. Tipo de Movimiento
    saldo NUMERIC,                       -- 16. Saldo
    control NUMERIC,                     -- 17. Control
    categ TEXT,                          -- 18. CATEG
    detalle TEXT,                        -- 19. Detalle
    contable TEXT,                       -- 20. Contable
    interno TEXT,                        -- 21. Interno
    centro_de_costo TEXT,                -- 22. Centro de Costo
    cuenta TEXT,                         -- 23. Cuenta
    orden NUMERIC                        -- 24. Orden
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

-- 6. Mostrar la estructura final de la tabla EN ORDEN
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

-- 8. Mostrar mensaje de confirmación
SELECT 'Tabla msa_galicia recreada con orden exacto de columnas' as mensaje;
