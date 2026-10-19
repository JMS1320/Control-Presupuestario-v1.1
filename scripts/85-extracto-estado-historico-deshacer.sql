-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 85 · DESHACER — vuelve el check de `public.msa_galicia.estado` a como estaba.
-- ⚠️ Falla (y no cambia nada) si quedó alguna fila en estado 'historico': primero hay que borrar o
-- reclasificar esas filas. Así está bien: no se pierde nada en silencio.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

alter table public.msa_galicia drop constraint msa_galicia_estado_check;
alter table public.msa_galicia add constraint msa_galicia_estado_check
  check (estado = any (array['Conciliado', 'Pendiente', 'Auditar', 'conciliado', 'pendiente', 'auditar']));

commit;
