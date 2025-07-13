-- Insertar la nueva fila "VER" con seccion = 2

-- 1. Insertar la fila VER
INSERT INTO distribucion_socios (interno, concepto, orden, seccion) 
VALUES ('VER', 'Ver', 7, 2);

-- 2. Verificar que se insertó correctamente
SELECT 
    orden,
    interno,
    concepto,
    seccion,
    created_at
FROM distribucion_socios 
ORDER BY seccion, orden;

-- 3. Mostrar resumen por sección
SELECT 
    seccion,
    COUNT(*) as cantidad_filas,
    STRING_AGG(concepto, ', ' ORDER BY orden) as conceptos
FROM distribucion_socios 
GROUP BY seccion 
ORDER BY seccion;

-- Mensaje de confirmación
SELECT 'Fila VER insertada con seccion = 2. Total: 7 filas (6 en sección 1, 1 en sección 2)' as mensaje;
