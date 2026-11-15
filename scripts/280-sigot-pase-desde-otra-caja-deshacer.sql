-- Deshace el 280: vuelve los 2 a «Pase desde el banco» y saca la marca.
begin;
update msa.caja_sigot set descripcion = 'Pase desde el banco', nota_operador = replace(nota_operador, ' · [script 280]', '')
 where id in ('18e9f1e4-510e-41a2-bfaa-1c9fece4c927', '87ba9dff-ecea-4367-a644-9f91b9e2b809') and nota_operador like '%[script 280]%';
commit;
