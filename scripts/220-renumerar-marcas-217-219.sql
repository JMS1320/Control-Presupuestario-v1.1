-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔢 Script 220 — renumera las MARCAS de los scripts de camino 1 que chocaron con camino 3 (06/11)
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Camino 1 corrió sus 212/213/214 cuando camino 3 ya había corrido los suyos con esos números. Para que cada número
-- tenga un solo script, los de camino 1 pasan a 217/218/219 (archivos renombrados) y sus filas cambian de marca:
--   · documentos_respaldo   '[script 212]' → '[script 217]'  (49 filas, extractos)
--   · balance_datos_usuario '[script 213]' → '[script 218]'  (2 filas, granos cosecha y cierre)
--   · documentos_respaldo   '[script 214]' → '[script 219]'  (24 filas, VISA)
-- Sólo cambia el prefijo de creado_por / actualizado_por; ningún valor. Los 212/213/214 de camino 3 escriben en otras
-- tablas y no se tocan. OK de JMS 06/11: «ok, renumerá los tuyos a 217-219».
-- Deshacer: 220-renumerar-marcas-217-219-deshacer.sql (vuelve los prefijos).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;
update public.documentos_respaldo set creado_por = '[script 217]' || substr(creado_por, 13) where creado_por like '[script 212]%';
update public.documentos_respaldo set creado_por = '[script 219]' || substr(creado_por, 13) where creado_por like '[script 214]%';
update public.balance_datos_usuario set actualizado_por = '[script 218]' || substr(actualizado_por, 13)
  where empresa='MSA' and anio_cierre=2026 and papel='granos' and actualizado_por like '[script 213]%';
commit;

-- ── Control (sólo lee): 49 · 24 · 2 con la marca nueva, 0 con la vieja ──
select substring(creado_por from '^.script \d+.') m, count(*) from public.documentos_respaldo group by 1
union all
select substring(actualizado_por from '^.script \d+.'), count(*) from public.balance_datos_usuario where actualizado_por like '[script 21%' group by 1;
