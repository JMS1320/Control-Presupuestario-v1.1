-- Verificación final completa de la tabla distribucion_socios

-- 1. Estructura de la tabla
SELECT '=== ESTRUCTURA FINAL ===' as titulo;
SELECT 
    ordinal_position as posicion,
    column_name as columna,
    data_type as tipo,
    is_nullable as acepta_null
FROM information_schema.columns 
WHERE table_name = 'distribucion_socios' 
ORDER BY ordinal_position;

-- 2. Datos completos
SELECT '=== DATOS EN distribucion_socios ===' as titulo;
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as "#",
    interno,
    concepto,
    created_at::date as fecha_creacion
FROM distribucion_socios 
ORDER BY created_at;

-- 3. Constraints y relaciones
SELECT '=== CONSTRAINTS ACTIVOS ===' as titulo;
SELECT 
    constraint_name as nombre,
    constraint_type as tipo
FROM information_schema.table_constraints 
WHERE table_name = 'distribucion_socios'
ORDER BY constraint_type;

-- 4. Políticas RLS activas
SELECT '=== POLÍTICAS RLS ACTIVAS ===' as titulo;
SELECT 
    policyname as politica,
    cmd as comando
FROM pg_policies 
WHERE tablename = 'distribucion_socios'
ORDER BY policyname;

-- 5. Resumen final
SELECT '=== RESUMEN FINAL ===' as titulo;
SELECT 
    'distribucion_socios' as nombre_tabla,
    (SELECT COUNT(*) FROM distribucion_socios) as total_registros,
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE table_name = 'distribucion_socios') as total_constraints,
    (SELECT COUNT(*) FROM pg_policies 
     WHERE tablename = 'distribucion_socios') as total_politicas_rls,
    'Tabla renombrada exitosamente' as estado;

-- 6. Confirmar que la tabla anterior ya no existe
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categorias_interno')
        THEN '❌ La tabla anterior aún existe'
        ELSE '✅ Tabla anterior eliminada correctamente'
    END as verificacion_tabla_anterior;
