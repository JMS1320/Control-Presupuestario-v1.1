-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 63 · El mapeo gobierna la ESCRITURA; la lectura se comparte    A-SEC-10 · 2026-09-24
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- ARREGLA UN DEFECTO DE `scripts/62`, DEL MISMO DÍA.
--
--   `recurso_tablas` asume «una tabla, un recurso». Medido después de correrlo, eso es FALSO:
--
--     · `actividades`, `actividad_insumos`, `movimientos_hacienda`, `categorias_hacienda`
--       están mapeadas a `productivo`, pero las leen los configuradores y el **panel de margen**,
--       que es Presupuesto.
--     · `caja_general` la leen **Sueldos** y **Cash Flow**, no sólo Extracto.
--     · `cuotas_egresos_sin_factura` aparece en **27 archivos**.
--
--   Como la policy aplicaba el mapeo tanto a leer como a escribir, **alguien con Presupuesto pero
--   sin Productivo encontraba el panel de margen roto**. No se notó porque las dos cuentas son
--   `admin` y tienen todas las secciones: se habría notado el primer día que existiera un rol
--   acotado — justo el que se iba a crear para probar.
--
-- LA CORRECCIÓN, en una frase:
--   **una tabla se ESCRIBE desde un lado y se LEE desde varios.**
--   El mapeo gobierna la escritura, que es donde está el riesgo real; la lectura alcanza con tener
--   rol, salvo que la tabla se marque explícitamente como sensible.
--
-- ⚠️ `restringe_lectura` existe pero arranca en `false` en TODAS. Marcar una tabla rompe las
--    pantallas de otras secciones que la lean — por eso se hace de a una y midiendo, no en bloque.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

alter table public.recurso_tablas
  add column if not exists restringe_lectura boolean not null default false;

comment on column public.recurso_tablas.restringe_lectura is
  'A-SEC-10 — por defecto el mapeo gobierna SÓLO la escritura: las tablas se leen desde varias secciones. Poner true sólo en tablas sensibles, sabiendo que romperá las pantallas de otras secciones que las lean.';

create or replace function public.puede_ver(p_schema text, p_tabla text)
returns boolean language sql stable as $fn$
  select case
    -- Sólo las marcadas como sensibles miran el permiso fino para LEER.
    when exists (select 1 from public.recurso_tablas rt
                 where rt.schema_nombre = p_schema and rt.tabla = p_tabla
                   and rt.restringe_lectura)
      then public.nivel_tabla(p_schema, p_tabla) in ('lectura', 'escritura')
    -- El resto: alcanza con tener rol. Es lo que permite que Cash Flow lea `caja_general`
    -- sin tener la sección Extracto.
    else coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> ''
  end
$fn$;

-- `puede_escribir` NO cambia: el mapeo sigue gobernando la escritura.

-- ── Control ──────────────────────────────────────────────────────────────────────────────────
-- Tiene que devolver 45 filas, todas con restringe_lectura = false.
select schema_nombre, tabla, recurso, restringe_lectura
from public.recurso_tablas order by 1, 2;

-- ── REVERT ───────────────────────────────────────────────────────────────────────────────────
-- create or replace function public.puede_ver(p_schema text, p_tabla text)
-- returns boolean language sql stable as $fn$
--   select public.nivel_tabla(p_schema, p_tabla) in ('lectura', 'escritura')
-- $fn$;
-- alter table public.recurso_tablas drop column if exists restringe_lectura;
