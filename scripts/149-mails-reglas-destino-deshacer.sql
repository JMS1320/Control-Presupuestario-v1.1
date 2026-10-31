-- Deshace 149 · saca la columna archivo_destino de mails_reglas (la creó el 149, que frena si ya existía).
-- ⚠️ Se pierde qué regla va a qué carpeta (las carpetas en sí quedan en archivo_destinos; el Drive no se toca).
begin;
alter table public.mails_reglas drop column archivo_destino;
commit;
notify pgrst, 'reload schema';
