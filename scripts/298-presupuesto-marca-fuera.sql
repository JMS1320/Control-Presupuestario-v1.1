-- 298 · A-FEAT-1661 capa 1 — «sacar del presupuesto» un template entero o un mes de un template, sin tocar el template
-- (JMS 25/11: «desactivarlo del presupuesto, pero sólo del presupuesto… un presupuesto es una cosa fluida»).
-- Marca 'fuera' en presupuesto_marcas: origen_tabla 'egresos_sin_factura', fila_id = id del template (entero) o
-- '<id>|YYYY-MM' (ese mes). Deshacer: 298-…-deshacer.sql (sólo si no hay marcas 'fuera').
alter table public.presupuesto_marcas drop constraint presupuesto_marcas_marca_check;
alter table public.presupuesto_marcas add constraint presupuesto_marcas_marca_check
  check (marca in ('pagado', 'cobrado', 'impago', 'no_concretado', 'impacta', 'fuera'));
