-- 297 · A-FEAT-1660 C2 — «disponible a fijar»: no suma salvo que JMS marque que IMPACTA (JMS 25/11: «lo disponible pero no
-- ejecutado o vendido o cobrado no debe sumar. Solo se debe mostrar… poner que impacte o que no impacte»).
-- Suma el valor 'impacta' a las marcas del presupuesto (una por cuota de arrendamiento: origen_tabla 'cuotas_arrendamiento').
-- Deshacer: 297-…-deshacer.sql (vuelve el CHECK de antes; sólo si no hay marcas 'impacta').
alter table public.presupuesto_marcas drop constraint presupuesto_marcas_marca_check;
alter table public.presupuesto_marcas add constraint presupuesto_marcas_marca_check
  check (marca in ('pagado', 'cobrado', 'impago', 'no_concretado', 'impacta'));
