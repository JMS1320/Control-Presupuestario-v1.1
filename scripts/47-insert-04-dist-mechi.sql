-- Insertar CUARTA fila: DIST MECHI

INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST MECHI', 'Distribucion Mechi');

-- Verificar inserción
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as posicion,
    interno,
    concepto,
    created_at
FROM distribucion_socios 
ORDER BY created_at;

-- Confirmar
SELECT '4/6 - DIST MECHI insertada correctamente' as progreso;
