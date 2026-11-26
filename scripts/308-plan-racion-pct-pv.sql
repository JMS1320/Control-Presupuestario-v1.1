-- 308 · A-FEAT-1665 (c) — ESTRUCTURA. El plan del año pisa el «% del peso vivo» de la ración de una actividad en una campaña
-- (JMS 26/11: «cada cosa de la receta tiene que poder ser editada para el plan productivo del año»). Aviso previo en ENTRE-DESARROLLADORES.
-- Verificado antes de correr: la columna NO existe.
alter table public.presupuesto_variables add column if not exists racion_pct_pv numeric;
