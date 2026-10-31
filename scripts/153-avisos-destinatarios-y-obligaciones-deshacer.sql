-- Deshace 153 · borra las 2 tablas y el índice (los creó el 153, que frena si ya existían).
-- ⚠️ Se pierde a quién va cada aviso. Las tareas del mes que ya se crearon quedan en revisiones (origen 'obligacion').
begin;
drop index public.revisiones_obligacion_unica;
delete from public.recurso_tablas where schema_nombre = 'public' and tabla in ('avisos_destinatarios','obligaciones_recurrentes') and motivo like '[script 153]%';
drop table public.obligaciones_recurrentes;
drop table public.avisos_destinatarios;
commit;
notify pgrst, 'reload schema';
