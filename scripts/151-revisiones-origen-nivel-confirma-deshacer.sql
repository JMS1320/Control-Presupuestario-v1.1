-- Deshace 151 · saca las 4 columnas de public.revisiones (las creó el 151, que frena si ya existían).
-- ⚠️ Antes: las tareas en 'por_confirmar' vuelven a 'abierta' (si no, quedarían en un estado que la app vieja no lista).
begin;
update public.revisiones set estado = 'abierta' where estado = 'por_confirmar';
alter table public.revisiones drop column origen, drop column senales, drop column confirma, drop column cierre_auto;
commit;
notify pgrst, 'reload schema';
