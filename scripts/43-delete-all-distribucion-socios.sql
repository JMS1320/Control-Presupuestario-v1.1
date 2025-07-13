-- Borrar TODAS las filas de distribucion_socios

DELETE FROM distribucion_socios;

-- Verificar que la tabla esté completamente vacía
SELECT 
    COUNT(*) as registros_restantes,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ TABLA COMPLETAMENTE VACÍA'
        ELSE '❌ AÚN HAY ' || COUNT(*) || ' REGISTROS'
    END as estado
FROM distribucion_socios;

-- Mensaje de confirmación
SELECT 'Todas las filas eliminadas. Lista para insertar una por una.' as mensaje;
