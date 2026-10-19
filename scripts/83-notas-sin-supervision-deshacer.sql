-- 83 · DESHACER — saca la marca «sin supervisión» de las notas (A-FEAT-1266).
-- ⚠️ Antes de correrlo hay que volver atrás el código: el botón de notas escribe esta columna al
-- guardar, y sin ella el guardado de una nota falla entero.
-- Se pierde qué notas estaban marcadas (no hay otro lugar donde quede).

alter table public.notas_para_claude drop column if exists sin_supervision;

notify pgrst, 'reload schema';
