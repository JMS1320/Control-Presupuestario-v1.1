-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 85 · Estado «historico» en el extracto de MSA                       A-DEC-1009 · A-DAT-68 · 2026-10-15
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Decisión del usuario 2026-10-15: el extracto de MSA jul-2025 → ene-2026 se carga ENTERO en
-- `public.msa_galicia` como histórico, y se clasifica después de a lotes por CATEG — *«así no
-- alteramos la manera en que la app trabaja»*. Los códigos contable/interno siguen viviendo en el
-- movimiento, como hoy.
--
-- Los movimientos que todavía no se clasificaron necesitan un estado propio:
--   · no pueden ir en «pendiente»: el motor de conciliación los tomaría y los querría vincular contra
--     el Cash Flow de hoy;
--   · «auditar» ya significa otra cosa para el usuario;
--   · «conciliado» sería mentir (no tienen vínculo).
-- El check de la tabla sólo admite conciliado / pendiente / auditar → se agrega «historico».
--
-- ADITIVO: no toca ninguna fila. Sólo amplía los valores permitidos. Ningún trigger en la tabla.
-- ⚠️ ANTES de correrlo: aviso a Javier en ENTRE-DESARROLLADORES.md (la BD es una sola).
-- Revert: scripts/85-extracto-estado-historico-deshacer.sql (sólo si no quedó ninguna fila «historico»).
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

alter table public.msa_galicia drop constraint msa_galicia_estado_check;
alter table public.msa_galicia add constraint msa_galicia_estado_check
  check (estado = any (array['Conciliado', 'Pendiente', 'Auditar', 'conciliado', 'pendiente', 'auditar', 'historico']));

commit;

-- Verificación (no escribe): tiene que listar 'historico' entre los valores.
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'msa_galicia_estado_check';
