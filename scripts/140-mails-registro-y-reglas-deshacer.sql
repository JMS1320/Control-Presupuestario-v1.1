-- Deshace 140 · registro y reglas de los mails (A-FEAT-1425).
--
-- Borra SÓLO lo que creó el 140, y lo comprueba en la base antes:
--   · cada tabla tiene que llevar el comentario '[script 140]' (si no, no la creó el 140: se frena todo);
--   · mails_registro tiene que estar VACÍA: si el GAS ya registró mails, se frena — se decide con JMS;
--   · mails_reglas sólo puede tener las reglas del 140 (nota '[script 140]'): si alguien agregó una, se frena;
--   · las filas de recurso_tablas se borran sólo si su motivo lleva la marca '[script 140]'.

begin;

do $$
declare n int;
begin
  if to_regclass('public.mails_registro') is null and to_regclass('public.mails_reglas') is null then
    raise notice 'No existen: nada que deshacer.';
    return;
  end if;
  if coalesce(obj_description('public.mails_registro'::regclass), '') not like '[script 140]%'
     or coalesce(obj_description('public.mails_reglas'::regclass), '') not like '[script 140]%' then
    raise exception 'Alguna tabla no tiene la marca [script 140]: no la creó el 140. No se borra nada.';
  end if;
  select count(*) into n from public.mails_registro;
  if n > 0 then raise exception 'mails_registro tiene % mail(s) registrados: no se borra sin decidirlo con JMS.', n; end if;
  select count(*) into n from public.mails_reglas where coalesce(nota, '') not like '[script 140]%';
  if n > 0 then raise exception 'mails_reglas tiene % regla(s) que no son del 140: no se borra sin decidirlo con JMS.', n; end if;

  delete from public.recurso_tablas where schema_nombre = 'public' and tabla in ('mails_registro','mails_reglas') and motivo like '[script 140]%';
  drop table public.mails_registro;
  drop table public.mails_reglas;
end $$;

commit;
notify pgrst, 'reload schema';
