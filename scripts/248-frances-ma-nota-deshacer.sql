-- Deshace el 248: devuelve la nota_operador del movimiento a la foto (248-foto-antes.json).
begin;
update public.pam_galicia set nota_operador = '📜 Histórico PAM ene25-ene26 — tu planilla: CATEG DIST MA · Contable DIST MA · Interno DIST MA'
 where id = '22b48092-cbc3-42e2-a601-5e581d72d46e' and nota_operador like '%[script 248]';
commit;
