-- Deshace 106 · plan sanitario + IATF (A-FEAT-1380).
--
-- Borra SÓLO lo que creó el 106, y lo comprueba en la base antes:
--   · cada tabla tiene que llevar el comentario '[script 106]' (si no, no la creó el 106: se frena);
--   · el registro, las propuestas y las IATF tienen que estar VACÍAS: si el usuario ya cargó algo, se frena
--     (borrarlo perdería su trabajo — primero se decide con él). Las tareas del plan sí se borran: las cargó el 106.
--   · las labores nuevas se borran sólo si se crearon en la MISMA transacción que el plan (misma hora exacta)
--     y ninguna orden las usa. Las que ya existían antes del 106 no se tocan.
--   · las filas de recurso_tablas se borran sólo si llevan la marca '[script 106]'.

begin;

do $$
declare t text; n int; marca timestamp;
begin
  if to_regclass('productivo.plan_sanitario_tareas') is null then
    raise notice 'El 106 no está aplicado: no hay nada que deshacer.';
    return;
  end if;
  foreach t in array array['plan_sanitario_tareas','plan_sanitario_registro','plan_sanitario_propuestas','iatf','iatf_toros'] loop
    if coalesce(obj_description(('productivo.' || t)::regclass), '') not like '[script 106]%' then
      raise exception 'productivo.% no tiene la marca [script 106]: no la creó el 106. No se borra.', t;
    end if;
  end loop;
  foreach t in array array['plan_sanitario_registro','plan_sanitario_propuestas','iatf','iatf_toros'] loop
    execute format('select count(*) from productivo.%I', t) into n;
    if n > 0 then
      raise exception 'productivo.% tiene % fila(s) cargadas desde la app: no se borra sin decidirlo con el usuario.', t, n;
    end if;
  end loop;

  select min(created_at)::timestamp into marca from productivo.plan_sanitario_tareas where actualizado_por = '[script 106]';
  delete from productivo.labores l
  where l.nombre in ('Colocación dispositivos IATF','Retiro dispositivos IATF','IATF','Revisación de toros','Corte de parición',
                     'Corte de cola','Corte de oreja','Abichados','Caravana mosca')
    and marca is not null and abs(extract(epoch from (l.created_at - marca))) < 5
    and not exists (select 1 from productivo.lineas_orden_labores x where x.labor_id = l.id);

  delete from public.recurso_tablas where motivo like '[script 106]%';
  drop table productivo.iatf_toros;
  drop table productivo.iatf;
  drop table productivo.plan_sanitario_propuestas;
  drop table productivo.plan_sanitario_registro;
  drop table productivo.plan_sanitario_tareas;
end $$;

commit;
notify pgrst, 'reload schema';
