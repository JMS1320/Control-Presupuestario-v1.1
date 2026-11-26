-- 300 · A-FEAT-1663 — el PLAN PRODUCTIVO DEL AÑO: las «variables de costo» se reaprovechan, atadas a la receta
-- JMS 25/11: «la receta es el default… el plan productivo del año es lo específico que queda vigente y reemplaza a la receta»;
-- OK a reaprovechar `presupuesto_variables` (estaba casi vacía: 2 filas sin efecto). Tres columnas nuevas, vacías:
--   · receta_insumo_id — el renglón de receta (productivo.actividad_insumos) que este renglón del plan reemplaza en su campaña
--   · actividad_id     — la actividad (productivo.actividades) de un renglón propio del plan (que no está en la receta)
--   · moneda           — 'ARS' o 'USD' (en US$ se multiplica por el TC de cada mes)
-- Las filas con receta_insumo_id o actividad_id son PLAN DEL AÑO y no las lee el bloque «Variables de costo» (no se cuentan dos veces).
-- Deshacer: 300-…-deshacer.sql (borra sólo estas tres columnas, que no existían).
alter table public.presupuesto_variables add column receta_insumo_id uuid;
alter table public.presupuesto_variables add column actividad_id uuid;
alter table public.presupuesto_variables add column moneda text;
comment on column public.presupuesto_variables.receta_insumo_id is 'A-FEAT-1663: renglón de receta que este renglón del PLAN DEL AÑO reemplaza en su campaña.';
comment on column public.presupuesto_variables.actividad_id is 'A-FEAT-1663: actividad de un renglón propio del plan del año.';
