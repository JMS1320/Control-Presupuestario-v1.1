-- Insertar SEGUNDA fila: DIST MANU

INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST MANU', 'Distribucion Manuel');

-- Verificar inserción
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as posicion,
    interno,
    concepto,
    created_at
FROM distribucion_socios 
ORDER BY created_at;

-- Confirmar
SELECT '2/6 - DIST MANU insertada correctamente' as progreso;
