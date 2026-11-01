-- Deshace 172: borra sólo las reglas que creó (cuenta msa_cc_usd y marca en el detalle).
delete from public.reglas_conciliacion where cuenta_bancaria_id = 'msa_cc_usd' and detalle like '%[script 172]';
