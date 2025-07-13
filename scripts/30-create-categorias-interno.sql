-- Crear nueva tabla para categorías por campo "interno"
CREATE TABLE categorias_interno (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interno TEXT NOT NULL UNIQUE,
    concepto TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE categorias_interno ENABLE ROW LEVEL SECURITY;

-- Crear políticas básicas para permitir operaciones
CREATE POLICY "Allow public read on categorias_interno" ON categorias_interno FOR SELECT USING (true);
CREATE POLICY "Allow public insert on categorias_interno" ON categorias_interno FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on categorias_interno" ON categorias_interno FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on categorias_interno" ON categorias_interno FOR DELETE USING (true);

-- Verificar que la tabla se creó correctamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'categorias_interno' 
ORDER BY ordinal_position;

-- Mostrar mensaje de confirmación
SELECT 'Tabla categorias_interno creada exitosamente' as mensaje;
