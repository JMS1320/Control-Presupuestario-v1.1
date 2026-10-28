-- Deshace 127: borra la cuenta MONEDA EXTRANJERA sólo si la creó el 127 (marca en cambio_nombre_cta) y si
-- ningún movimiento de las cuentas en dólares/Cotitulares la usa todavía.
begin;
do $$
declare n int := 0; t text;
begin
  foreach t in array array['msa.cc_usd','msa.caja_usd','ma.ca_usd','ma.caja_usd',
                           'public.cotitulares_ca_usd','public.cotitulares_ca_pesos','public.cotitulares_caja_usd',
                           'msa.caja_general','msa.caja_ams','msa.caja_sigot'] loop
    execute format('select count(*) from %s where categ = %L', t, 'MONEDA EXTRANJERA') into n;
    if n > 0 then raise exception '% tiene % movimiento(s) con MONEDA EXTRANJERA: no se borra.', t, n; end if;
  end loop;
  delete from public.cuentas_contables where categ = 'MONEDA EXTRANJERA' and cambio_nombre_cta = '[script 127] A-FEAT-1398';
end $$;
commit;
