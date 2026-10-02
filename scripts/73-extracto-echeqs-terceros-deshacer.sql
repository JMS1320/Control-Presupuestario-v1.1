-- 🔙 DESHACER 73 — borra la cuenta de echeqs de terceros.
-- ⚠️ Con freno: si ya tiene filas, NO se deshace (es un registro de conciliación; se perdería lo
-- imputado a mano). Las filas se pueden regenerar desde los cheques, pero las cuentas que se
-- eligieron a mano no.

do $$
declare n int;
begin
  select count(*) into n from msa.echeqs_terceros;
  if n > 0 then
    raise exception 'msa.echeqs_terceros tiene % filas: deshacer las perdería. No se toca nada.', n;
  end if;
end $$;

begin;
delete from public.recurso_tablas where schema_nombre = 'msa' and tabla = 'echeqs_terceros';
drop table if exists msa.echeqs_terceros;
commit;

notify pgrst, 'reload schema';
