-- 159 · UNA CAPTURA EN LA RESPUESTA DE UN TEMA DEL BALANCE (ESTRUCTURA) — A-FEAT-1454 (resto)
--
-- Qué hace: agrega `imagen text` (la captura, comprimida como data-URL, igual que `public.revisiones.imagen`) a
-- `public.balance_pendientes`, donde vive «Tu respuesta» de cada tema del recorrido. Vacía. No toca datos. Sin cambios de
-- RLS ni de permisos (la tabla ya los tiene).
--
-- Por qué: JMS 01/11 — «si para pegar una captura hay que pasarme el tema a mí, merece una mejora rápida para evitar un
-- rulo ineficiente» · «dale, agregá la columna para pegar captura».
--
-- Marca: comentario '[script 159]'. Deshacer: 159-…-deshacer.sql (sólo si sigue vacía).

alter table public.balance_pendientes add column if not exists imagen text;
comment on column public.balance_pendientes.imagen is '[script 159] Captura pegada en «Tu respuesta» del recorrido (data-URL comprimida).';

-- Control (sólo lee)
select column_name, data_type, col_description('public.balance_pendientes'::regclass, ordinal_position) from information_schema.columns
 where table_schema = 'public' and table_name = 'balance_pendientes' and column_name = 'imagen';
