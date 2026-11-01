-- Deshace 164 · borra `cheque_id` de las 3 tablas SÓLO si es la del 164 y sigue vacía.
do $$
declare t text; s text; n int;
begin
  foreach t in array array['public.msa_galicia', 'msa.santander', 'msa.provincia'] loop
    select col_description(t::regclass, a.attnum) into s from pg_attribute a where a.attrelid = t::regclass and a.attname = 'cheque_id';
    if s is null or s not like '[script 164]%' then raise notice '% : cheque_id no es la del 164, no se toca', t; continue; end if;
    execute format('select count(*) from %s where cheque_id is not null', t) into n;
    if n > 0 then raise exception '% tiene % movimientos con cheque_id: revisar a mano', t, n; end if;
    execute format('alter table %s drop column cheque_id', t);
  end loop;
end $$;
