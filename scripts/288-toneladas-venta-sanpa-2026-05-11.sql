-- 288 · Toneladas de la factura de arrendamiento a Sanpa del 11/05/2026 (DATOS)  A-FEAT-1629
-- JMS 18/11: «las toneladas que te faltan de una venta de Sanpa son 212,96 para el 11/05» · «si es sólo agregar ese detalle y no
-- nos cambia nada, agregalas al sistema». La factura (Fac A 0010-00000020, $ 95.715.830,32, cuenta 4109) no tenía grano ni toneladas;
-- las otras dos de Sanpa del ejercicio tienen SOJA y 159,72 t. No cambia ningún importe.
-- Toca 1 fila de msa.comprobantes_venta (por id). Deshacer: 288-…-deshacer.sql.

begin;

update msa.comprobantes_venta
   set toneladas = 212.96, grano = 'SOJA', updated_at = now()
 where id = '3e885754-e800-416e-9e71-6e1c096da113' and toneladas is null and grano is null;

commit;
