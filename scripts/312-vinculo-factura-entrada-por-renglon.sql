-- [script 312] ESTRUCTURA — el vínculo factura ↔ entrada al stock, renglón por renglón (A-FEAT-1663 stock paso 1; JMS 27/11: «dale, seguí hasta terminarlo»).
-- Sólo AGREGA columnas (verificado el 27/11: ninguna existía). Aviso previo en ENTRE-DESARROLLADORES.md. Sin RLS ni permisos nuevos.
-- Deshacer: scripts/312-vinculo-factura-entrada-por-renglon-deshacer.sql
begin;
alter table productivo.entrega_factura
  add column if not exists renglon_n int,                              -- a qué renglón de la factura corresponde
  add column if not exists automatico boolean not null default false,  -- ✨ lo hizo la app sola
  add column if not exists antes jsonb,                                -- la huella: lo que tenía la entrada antes de que la factura la corrigiera
  add column if not exists revisado_at timestamptz,                    -- JMS miró el vínculo solo
  add column if not exists revisado_por text;
alter table public.factura_renglones
  add column if not exists no_vincular_solo boolean not null default false;  -- «no es ésta»: no se vuelve a vincular solo
commit;
