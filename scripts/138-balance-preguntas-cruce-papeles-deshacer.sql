-- Deshacer del script 138: borra SÓLO las preguntas que cargó ese script (marca «[script 138]» en creado_por).
-- Si JMS ya contestó alguna, se pierde su respuesta: mirar antes con
--   select texto, estado, resolucion from public.balance_pendientes where creado_por like '%[script 138]%';
begin;
delete from public.balance_pendientes where creado_por like '%[script 138]%';
commit;
