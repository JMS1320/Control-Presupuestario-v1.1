-- Deshace el 271 (271-foto-antes.json).
begin;
update public.msa_galicia set contable = '', nota_operador = 'Ver con Mauricio' where id = '5371c7f0-4db8-4739-b252-c71491770167' and nota_operador like '%[script 271]';
commit;
