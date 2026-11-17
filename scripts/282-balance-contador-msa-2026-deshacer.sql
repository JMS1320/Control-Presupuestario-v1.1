-- 282 · DESHACER: saca el balance del contador de MSA 30/06/2026 y, si la tabla queda vacía, la tabla que creó el 282.
-- La tabla la creó el 282 (no existía antes: verificado el 17/11). Igual, sólo se borra si no quedó NADA que no sea del 282.

begin;

delete from public.balance_contador_cuentas where marca = '[script 282]';

do $$
begin
  if (select count(*) from public.balance_contador_cuentas) = 0 then
    drop table public.balance_contador_cuentas;
    delete from public.recurso_tablas where schema_nombre = 'public' and tabla = 'balance_contador_cuentas' and motivo like '[script 282]%';
  else
    raise notice 'La tabla tiene filas que no son del script 282: no se borra.';
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
