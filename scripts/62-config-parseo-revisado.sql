-- ─────────────────────────────────────────────────────────────────────────────
-- config_parseo_extracto.revisado_en — la marca «ya lo revisé y está bien»
--
-- A-FEAT-1180, 2026-09-25. Pedido del usuario: *«¿me agregás un check para dejar marcados los que
-- ya doy por buenos así no los vuelvo a revisar?»*. Con 15 subtipos y varias vueltas de edición,
-- sin esto no hay forma de saber qué falta mirar.
--
-- POR QUÉ VA EN ESTA TABLA Y NO EN UNA NUEVA
--   · un subtipo **sin reglas** no se puede dar por bueno: todavía es trabajo pendiente;
--   · hereda tal cual las políticas `puede_ver` / `puede_escribir` del modelo de permisos, sin
--     tocar nada de seguridad.
--
-- CÓMO FUNCIONA
--   Un subtipo está revisado cuando **todas** sus reglas propias tienen la marca. Al guardar una
--   regla se escribe `revisado_en = null`: si algo cambió, hay que volver a mirarlo. Un «ya lo vi»
--   que sobrevive a un cambio es peor que no tener marca — tapa justo lo que había que revisar.
--
-- ⚠️ YA APLICADO el 2026-09-25 vía MCP, autorizado por el usuario. Queda acá para el registro y
--    para reconstruir la base desde cero.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.config_parseo_extracto
  add column if not exists revisado_en timestamptz;

comment on column public.config_parseo_extracto.revisado_en is
  'Cuándo el usuario dio por bueno el subtipo al que pertenece esta regla. Se limpia al editarla.';
