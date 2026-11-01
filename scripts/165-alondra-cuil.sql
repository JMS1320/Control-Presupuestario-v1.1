-- 165 · EL CUIL DE ALONDRA OLIVO (DATOS) — A-BUG-1475 — OK de JMS 01/11 («alondra corregí el cuit»).
-- Sueldos tenía 27-20361536-7; su alta en ARCA (legajo «26-02 - Alondra Olivo - Chalet», 22/04/2026, empleadora MA) y el banco
-- dicen 27-47926088-0. El viejo no es de ninguna otra persona de la base ni de los legajos revisados (Libertad / Carmen).
-- ✅ CORRIDO 01/11/2026. Deshacer: 165-…-deshacer.sql.
update sueldos.empleados set cuit_empleado = '27-47926088-0'
 where id = '67f4f0aa-949a-404e-97ca-546b6751f1f1' and cuit_empleado = '27-20361536-7';
