-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 87 · La regla de conciliación elige el TEMPLATE, no la cuenta              A-FEAT-1293 · 2026-10-19
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Pedido del usuario 2026-10-19: *«yo trabajo con los templates, no con las cuentas; debería mostrar
-- el template para elegir en vez de cuentas»*. Hasta acá la regla guardaba sólo `categ` y el motor
-- buscaba «el template activo con esa cuenta y la empresa»: con varios de la misma cuenta y empresa
-- (Seguros Estructura MSA → Seguro Flota 25/26, 26/27 y Accidentes de Trabajo) tomaba EL PRIMERO.
--
-- Agrega `template_id` (nullable). Las reglas existentes quedan en null y siguen funcionando por
-- cuenta, como hasta hoy. `on delete set null`: si se borra el template, la regla vuelve al camino viejo
-- en vez de romperse.
--
-- ADITIVO: no toca filas, RLS, roles ni GRANTs. `reglas_conciliacion` es tabla de `public` (no vista).
-- ⚠️ Aviso a Javier en ENTRE-DESARROLLADORES.md (2026-10-19). Se corre con JMS presente.
-- Revert: scripts/87-reglas-template-deshacer.sql
-- ─────────────────────────────────────────────────────────────────────────────────────────────
begin;

alter table public.reglas_conciliacion
  add column if not exists template_id uuid
  references public.egresos_sin_factura(id) on delete set null;

comment on column public.reglas_conciliacion.template_id is
  'A-FEAT-1293: el template que llena la regla (lo elige el usuario). Null = regla vieja: va por categ + empresa. '
  'Al renovarse la campaña, el motor carga en el template de la misma familia (nombre + responsable) cuya campaña '
  'corresponde a la fecha del movimiento.';

commit;
notify pgrst, 'reload schema';

-- Verificación (sin escribir): tiene que devolver una fila.
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'reglas_conciliacion' and column_name = 'template_id';
