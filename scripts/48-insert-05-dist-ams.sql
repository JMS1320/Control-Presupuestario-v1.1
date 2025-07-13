-- Insertar QUINTA fila: DIST AMS

INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST AMS', 'Distribucion Andres');

-- Verificar inserción
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as posicion,
    interno,
    concepto,
    created_at
FROM distribucion_socios 
ORDER BY created_at;

-- Confirmar
SELECT '5/6 - DIST AMS insertada correctamente' as progreso;
