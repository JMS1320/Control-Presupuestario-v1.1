-- 98 · FACTURAS POR MES ESPERADAS de un proveedor fijo (A-FEAT-1332, usuario 2026-10-23/24)
--
-- «la idea es que esto se corra en el balance para hacer el check… también podría ser que lo corra
-- durante el año… como una especie de warning». El balance cuenta, mes por mes, las facturas de cada
-- proveedor fijo y avisa las que faltan, sobran o están repetidas.
--
-- Vacío (null) = no es un proveedor fijo: no se controla. Se edita en la ficha del proveedor.
-- Aditivo: columna nueva, nullable, verificada inexistente el 2026-10-24. No toca RLS, roles ni GRANTs
-- (los de la tabla alcanzan a la columna nueva). Ninguna vista lista la tabla por columnas para escribir.
-- Los valores iniciales (los 11 que auditó el usuario) se cargan aparte, con su OK, por CUIT.
-- Deshacer: 98-proveedores-facturas-por-mes-deshacer.sql

alter table public.proveedores add column if not exists facturas_por_mes smallint
  check (facturas_por_mes is null or facturas_por_mes between 1 and 31);

comment on column public.proveedores.facturas_por_mes is
  'Proveedor fijo: cuántas facturas trae por mes (null = no es fijo). Control de cantidad del balance, A-FEAT-1332';
