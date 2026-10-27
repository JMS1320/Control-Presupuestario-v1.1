-- Deshace 109 · «Se hizo» / «Confirmar» en órdenes (A-FEAT-1223).
--
-- Borra SÓLO lo que creó el 109, y lo comprueba antes:
--   · las columnas tienen que llevar el comentario '[script 109]' en marcada_por (si no, no las creó el 109: se frena);
--   · no puede haber órdenes en 'a_confirmar' (volver al check viejo las dejaría inválidas): si hay, se frena —
--     primero se confirman o rechazan desde la app;
--   · si alguna columna ya tiene datos (alguien marcó o confirmó), se frena: borrarla perdería la huella.

begin;

do $$
declare t text; n int;
begin
  foreach t in array array['ordenes_aplicacion','ordenes_agricolas'] loop
    if coalesce(col_description(('productivo.' || t)::regclass,
         (select attnum from pg_attribute where attrelid = ('productivo.' || t)::regclass and attname = 'marcada_por')), '') not like '[script 109]%' then
      raise exception 'productivo.%.marcada_por no tiene la marca [script 109]: no se borra.', t;
    end if;
    execute format('select count(*) from productivo.%I where estado = ''a_confirmar''', t) into n;
    if n > 0 then raise exception 'productivo.% tiene % orden(es) a confirmar: confirmarlas o rechazarlas antes.', t, n; end if;
    execute format('select count(*) from productivo.%I where coalesce(marcada_por, confirmada_por, motivo_rechazo) is not null or marcada_at is not null or confirmada_at is not null', t) into n;
    if n > 0 then raise exception 'productivo.% tiene % orden(es) con la huella cargada: no se borra sin decidirlo con JMS.', t, n; end if;
  end loop;

  alter table productivo.ordenes_aplicacion drop column marcada_por, drop column marcada_at, drop column confirmada_por,
    drop column confirmada_at, drop column motivo_rechazo;
  alter table productivo.ordenes_aplicacion drop constraint ordenes_aplicacion_estado_check;
  alter table productivo.ordenes_aplicacion add constraint ordenes_aplicacion_estado_check check (estado in ('planificada', 'ejecutada', 'eliminada'));

  alter table productivo.ordenes_agricolas drop column marcada_por, drop column marcada_at, drop column confirmada_por,
    drop column confirmada_at, drop column motivo_rechazo;
  alter table productivo.ordenes_agricolas drop constraint ordenes_agricolas_estado_check;
  alter table productivo.ordenes_agricolas add constraint ordenes_agricolas_estado_check check (estado in ('planificada', 'ejecutada', 'eliminada'));
end $$;

commit;
notify pgrst, 'reload schema';
