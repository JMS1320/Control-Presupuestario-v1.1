-- Verificar la estructura completa de categorias_interno y su relación

-- 1. Verificar estructura de la tabla
SELECT '=== ESTRUCTURA DE categorias_interno ===' as titulo;
SELECT 
    ordinal_position as posicion,
    column_name as columna,
    data_type as tipo,
    is_nullable as acepta_null,
    column_default as valor_default
FROM information_schema.columns 
WHERE table_name = 'categorias_interno' 
ORDER BY ordinal_position;

-- 2. Verificar datos insertados
SELECT '=== DATOS EN categorias_interno ===' as titulo;
SELECT 
    ROW_NUMBER() OVER (ORDER BY created_at) as "#",
    interno,
    concepto,
    created_at::date as fecha_creacion
FROM categorias_interno 
ORDER BY created_at;

-- 3. Verificar constraints y relaciones
SELECT '=== CONSTRAINTS Y RELACIONES ===' as titulo;
SELECT 
    tc.constraint_name as nombre_constraint,
    tc.constraint_type as tipo,
    kcu.column_name as columna,
    COALESCE(ccu.table_name, '') as tabla_referenciada,
    COALESCE(ccu.column_name, '') as columna_referenciada
FROM information_schema.table_constraints AS tc 
LEFT JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'categorias_interno'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 4. Verificar políticas RLS
SELECT '=== POLÍTICAS RLS ===' as titulo;
SELECT 
    policyname as nombre_politica,
    permissive as permisiva,
    roles as roles,
    cmd as comando,
    qual as condicion
FROM pg_policies 
WHERE tablename = 'categorias_interno';

-- 5. Resumen final
SELECT '=== RESUMEN FINAL ===' as titulo;
SELECT 
    (SELECT COUNT(*) FROM categorias_interno) as total_categorias,
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE table_name = 'categorias_interno' AND constraint_type = 'PRIMARY KEY') as tiene_primary_key,
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE table_name = 'categorias_interno' AND constraint_type = 'UNIQUE') as constraints_unique,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'categorias_interno') as politicas_rls;
