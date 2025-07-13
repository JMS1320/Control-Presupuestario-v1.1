-- Insertar SEXTA fila: DIST JMS (ÚLTIMA)

INSERT INTO distribucion_socios (interno, concepto) 
VALUES ('DIST JMS', 'Distribucion Jose');

-- Verificar inserción
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as posicion,
    interno,
    concepto,
    created_at
FROM distribucion_socios 
ORDER BY created_at;

-- Confirmar
SELECT '6/6 - DIST JMS insertada correctamente. ¡COMPLETADO!' as progreso;
