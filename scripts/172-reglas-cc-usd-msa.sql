-- 172 · A-FEAT-1503: reglas de conciliación de la cuenta corriente especial en DÓLARES de MSA (msa_cc_usd), las mismas que
-- esos conceptos tienen en el Galicia en pesos (JMS 01/11: «las reglas de cta cte dólares hacelas así; después corro la
-- conciliación»). El orden importa: «Percep. Iva» antes que «IVA» (exacto). Marca: detalle termina en ' [script 172]'.
do $$
begin
  if exists (select 1 from public.reglas_conciliacion where cuenta_bancaria_id = 'msa_cc_usd') then
    raise exception 'msa_cc_usd ya tiene reglas: no se duplican';
  end if;
  insert into public.reglas_conciliacion (orden, tipo, columna_busqueda, texto_buscar, tipo_match, categ, detalle, activo, llena_template, cuenta_bancaria_id) values
  (1, 'impuestos', 'descripcion', 'Percep. Iva',          'contiene', 'Percepcion IVA',           'Percepcion IVA [script 172]',           true, true, 'msa_cc_usd'),
  (2, 'impuestos', 'descripcion', 'Imp. Ing. Brutos',     'contiene', 'IIBB Bancario',            'IIBB Bancario [script 172]',            true, true, 'msa_cc_usd'),
  (3, 'impuestos', 'descripcion', 'Imp. Deb. Ley 25413',  'contiene', 'Debitos / Creditos',       'Debitos / Creditos [script 172]',       true, true, 'msa_cc_usd'),
  (4, 'impuestos', 'descripcion', 'IVA',                  'exacto',   'Iva Bancario',             'Iva Bancario [script 172]',             true, true, 'msa_cc_usd'),
  (5, 'bancarios', 'descripcion', 'Comision Mantenimiento','contiene','Comision Cuenta Bancaria', 'Comision Cuenta Bancaria [script 172]', true, true, 'msa_cc_usd'),
  (6, 'otras',     'descripcion', 'Google One',           'contiene', 'INFORMATICA',              'Google One [script 172]',               true, true, 'msa_cc_usd');
end $$;
