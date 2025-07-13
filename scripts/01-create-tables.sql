-- Crear enum para tipos de cuenta
CREATE TYPE tipo_cuenta AS ENUM ('ingreso', 'egreso', 'financiero', 'distribucion');

-- Tabla cuentas_contables
CREATE TABLE cuentas_contables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    cuenta_contable TEXT NOT NULL,
    tipo tipo_cuenta NOT NULL
);

-- Tabla msa_galicia
CREATE TABLE msa_galicia (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha DATE NOT NULL,
    descripcion TEXT,
    origen TEXT,
    debitos NUMERIC DEFAULT 0,
    creditos NUMERIC DEFAULT 0,
    saldo NUMERIC DEFAULT 0,
    control NUMERIC DEFAULT 0,
    categ TEXT REFERENCES cuentas_contables(codigo),
    detalle TEXT,
    contable TEXT,
    interno TEXT,
    centro_costo TEXT,
    cuenta TEXT
);

-- Habilitar RLS
ALTER TABLE cuentas_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE msa_galicia ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir lectura pública
CREATE POLICY "Allow public read on cuentas_contables" ON cuentas_contables FOR SELECT USING (true);
CREATE POLICY "Allow public read on msa_galicia" ON msa_galicia FOR SELECT USING (true);
