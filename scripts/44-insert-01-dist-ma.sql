-- Insertar PRIMERA fila: DIST MA

INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST MA', 'Distribucion Mama');

-- Verificar inserción
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as posicion,
    interno,
    concepto,
    created_at
FROM distribucion_socios 
ORDER BY created_at;

-- Confirmar
SELECT '1/6 - DIST MA insertada correctamente' as progreso;
