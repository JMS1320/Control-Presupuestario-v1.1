-- ─────────────────────────────────────────────────────────────────────────────
-- config_parseo_extracto.tipo_regla — permitir 'cbu' y 'tarjeta'
--
-- POR QUÉ (A-BUG-1204, 2026-09-25)
--   El motor (`lib/extractos/parseo-movimiento.ts`, `aplicarRegla`) implementa **siete** modos y
--   la pantalla de reglas los ofrece los siete en el desplegable «Cómo se extrae». La base sólo
--   acepta **cinco**: el CHECK se escribió antes de que existieran `cbu` y `tarjeta` y nunca se
--   amplió.
--
--   Resultado: elegir «Busca el CBU» o «Busca la tarjeta» y guardar devuelve
--   `violates check constraint "config_parseo_extracto_tipo_regla_check"`. Lo vio el usuario al
--   usar el preseteo automático (A-FEAT-1178), pero **no es de ahí**: pasa igual guardando a mano
--   desde el editor. Es un hueco viejo entre el código y la base.
--
--   🔑 Y son justo los dos modos que importan para la convención cerrada el 2026-09-24: el CBU va
--   a su columna y la tarjeta al instrumento, encontrados **estén en la línea que estén**.
--
-- QUÉ HACE
--   Reemplaza el CHECK por el mismo con dos valores más. Es aditivo: no toca ninguna fila, no
--   invalida ninguna regla existente y se revierte volviendo a la lista de cinco.
--
-- CÓMO SE CORRE
--   Supabase → SQL Editor → pegar y Run.
--   O bien: npx tsx scripts/correr-sql.mts scripts/61-tipo-regla-permitir-cbu-y-tarjeta.sql
--           (necesita DATABASE_URL en .env.local — ver el encabezado de ese script)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.config_parseo_extracto
  drop constraint if exists config_parseo_extracto_tipo_regla_check;

alter table public.config_parseo_extracto
  add constraint config_parseo_extracto_tipo_regla_check
  check (tipo_regla = any (array[
    'linea'::text,          -- la línea N del movimiento
    'cuit'::text,           -- busca el CUIT, esté donde esté
    'pre_cuit'::text,       -- la línea anterior al CUIT
    'post_cuit'::text,      -- la línea siguiente al CUIT
    'nro_operacion'::text,  -- busca «Nro Operacion: …»
    'cbu'::text,            -- ← NUEVO: busca los 22 dígitos del CBU
    'tarjeta'::text         -- ← NUEVO: busca la tarjeta enmascarada (4517XXXXXXXXXX11)
  ]));

-- Control: tiene que devolver los 7
select unnest(regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''::text', 'g')) as permitido
from pg_constraint
where conrelid = 'public.config_parseo_extracto'::regclass
  and conname = 'config_parseo_extracto_tipo_regla_check';
