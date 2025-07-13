-- Verificar y crear la estructura de cuentas_contables si no existe
-- (Este script es seguro de ejecutar múltiples veces)

-- Crear el enum si no existe
DO $$ BEGIN
    CREATE TYPE tipo_cuenta AS ENUM ('ingreso', 'egreso', 'financiero', 'distribucion');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Crear la tabla si no existe (aunque ya debería existir)
CREATE TABLE IF NOT EXISTS cuentas_contables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    cuenta_contable TEXT NOT NULL,
    tipo tipo_cuenta NOT NULL
);

-- Verificar que las columnas existan y agregarlas si faltan
DO $$ 
BEGIN
    -- Verificar columna codigo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cuentas_contables' AND column_name = 'codigo') THEN
        ALTER TABLE cuentas_contables ADD COLUMN codigo TEXT NOT NULL UNIQUE;
    END IF;
    
    -- Verificar columna cuenta_contable
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cuentas_contables' AND column_name = 'cuenta_contable') THEN
        ALTER TABLE cuentas_contables ADD COLUMN cuenta_contable TEXT NOT NULL;
    END IF;
    
    -- Verificar columna tipo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cuentas_contables' AND column_name = 'tipo') THEN
        ALTER TABLE cuentas_contables ADD COLUMN tipo tipo_cuenta NOT NULL;
    END IF;
END $$;

-- Limpiar datos existentes para insertar los nuevos
DELETE FROM cuentas_contables;

-- Insertar los nuevos registros
INSERT INTO cuentas_contables (codigo, cuenta_contable, tipo) VALUES
-- INGRESOS
('ARR NZ', 'Arrendamiento Nazarenas', 'ingreso'),
('ARR RO', 'Arrendamiento Rojas', 'ingreso'),
('VTA AGRIC', 'Venta Granos', 'ingreso'),
('VTA GAN', 'Ventas Ganaderia', 'ingreso'),
('VTA VARIOS', 'Ventas Varias', 'ingreso'),
('ARR LC GAN', 'Arrendamientos LC Ganaderos', 'ingreso'),
('ARR LC AGRIC', 'Arrendamientos LC Agricolas', 'ingreso'),

-- EGRESOS
('CZ', 'Comercializacion', 'egreso'),
('ARR P', 'Arrendamientos Pagados', 'egreso'),
('VET', 'Veterinaria', 'egreso'),
('CAB', 'CABALLOS', 'egreso'),
('INV GAN', 'Inversiones Ganaderia', 'egreso'),
('MAT GAN', 'Materiales Ganaderia', 'egreso'),
('AGUADAS', 'Aguadas', 'egreso'),
('ASES', 'Asesor Agric/Gan', 'egreso'),
('LAB GAN', 'Labores Ganaderas', 'egreso'),
('ALIM', 'Alimento Ganaderia', 'egreso'),
('ROLLOS', 'Rollos', 'egreso'),
('VERDEOS', 'Verdeos', 'egreso'),
('INS', 'Insumos', 'egreso'),
('LAB', 'Labores', 'egreso'),
('INSTAL', 'Instalaciones', 'egreso'),
('BUSO', 'Bienes de Uso', 'egreso'),
('SUELD', 'Sueldos', 'egreso'),
('JORN', 'Jornales', 'egreso'),
('HON', 'Honorarios', 'egreso'),
('COMB', 'Combustible', 'egreso'),
('AUTO', 'Automotores', 'egreso'),
('MANT', 'Mantenimiento', 'egreso'),
('CHALET', 'Gastos Chalet', 'egreso'),
('MAQ', 'Arreglos Maquinaria', 'egreso'),
('FLETES', 'Fletes Varios', 'egreso'),
('OF', 'Gastos Oficina', 'egreso'),
('INFORMATICA', 'Informatica', 'egreso'),
('FIJOS BS AS', 'Gastos Fijos Buenos Aires', 'egreso'),
('FIJOS SP', 'Gastos Fijos San Pedro', 'egreso'),
('FIJOS GRAL', 'Gastos Fijos General', 'egreso'),
('SEG', 'Seguros', 'egreso'),
('BANC', 'Gastos Bancarios', 'egreso'),
('VARIOS', 'Gastos Varios', 'egreso'),
('DOM', 'Empleada Domestica', 'egreso'),
('VER', 'VER', 'egreso'),
('IMP', 'Impuestos', 'egreso'),
('TARJ PAM', 'TARJETA VISA PAM', 'egreso'),
('TARJ MSA', 'Tarjeta Visa', 'egreso'),
('CAJA', 'Extracciones para Caja', 'egreso'),
('INTER', 'Transferencias Interbancarias', 'egreso'),
('REINT', 'Reintegros', 'egreso'),
('SALDO', 'Saldos en Tarjetas', 'egreso'),

-- FINANCIEROS
('FCI', 'Fondos Comunes de Inversion', 'financiero'),
('USS', 'Compra/Venta de Dolares', 'financiero'),
('CRED T', 'Creditos Tomados', 'financiero'),
('CRED P', 'Creditos Pagados', 'financiero'),
('AP', 'Aporte PAM', 'financiero'),
('RET', 'RETIROS PAM', 'financiero'),

-- DISTRIBUCIONES
('DIST HNOS', 'Distribucion Hnos', 'distribucion'),
('CTA HIJOS', 'Cuenta PAM Hijos', 'distribucion'),
('SUC ERM', 'SUC ERM', 'distribucion'),
('CONS', 'Consumo (suele ser Retiro)', 'distribucion'),
('MED', 'Gastos Medicos', 'distribucion'),
('DIST MA', 'Tranferencias a Mama Bco Frances', 'distribucion'),
('DON', 'DON', 'distribucion'),
('PROM GAL', 'PROM GAL', 'distribucion'),
('FLIA', 'FLIA', 'distribucion');

-- Verificar que los datos se insertaron correctamente
SELECT 
    tipo,
    COUNT(*) as cantidad
FROM cuentas_contables 
GROUP BY tipo 
ORDER BY tipo;

-- Mostrar todos los registros insertados
SELECT codigo, cuenta_contable, tipo 
FROM cuentas_contables 
ORDER BY tipo, codigo;
