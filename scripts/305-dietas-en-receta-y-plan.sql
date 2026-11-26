-- 305 · A-FEAT-1663 — DIETAS alternativas dentro de la receta, una por default, y la del año en el plan (ESTRUCTURA + DATOS)
-- JMS 26/11: «para engorde hay muchas dietas diferentes… se podría dejar como algunas alternativas dentro de la receta y después
-- dejar seleccionada cuál va por default… y a su vez yo en el plan productivo del año pongo cuál es la que estoy usando».
--   · actividad_insumos.dieta  — a qué dieta pertenece el renglón. NULL = va en todas.
--   · actividades.dieta_default — la que se usa si el plan del año no dice otra.
--   · presupuesto_variables.dieta — fila del plan atada a la ACTIVIDAD (actividad_id) que dice qué dieta va esa campaña.
-- La ración (consumoMensual) toma sólo los renglones de la dieta elegida + los que van en todas: vale para la grilla, el simulador y los tramos.
-- Deshacer: 305-…-deshacer.sql (las tres columnas no existían).
alter table productivo.actividad_insumos add column if not exists dieta text;
alter table productivo.actividades add column if not exists dieta_default text;
alter table public.presupuesto_variables add column if not exists dieta text;
comment on column productivo.actividad_insumos.dieta is '[script 305] Dieta a la que pertenece el renglón de la ración. NULL = va en todas.';
comment on column productivo.actividades.dieta_default is '[script 305] Dieta que se usa por default (si el plan del año no elige otra).';
comment on column public.presupuesto_variables.dieta is '[script 305] Plan del año: la dieta de la actividad en esa campaña (fila con actividad_id).';
-- Engorde: la de hoy pasa a ser la dieta «Maíz y concentrado» y queda por default (así una 2ª dieta no se le suma encima).
update productivo.actividad_insumos set dieta = 'Maíz y concentrado'
where id in ('d44f987b-9862-4596-a7ef-e896305ea24b', '3dfaad83-17e9-4336-896d-6134a1ced07f') and dieta is null;
update productivo.actividades set dieta_default = 'Maíz y concentrado' where nombre = 'Engorde' and activo and dieta_default is null;
