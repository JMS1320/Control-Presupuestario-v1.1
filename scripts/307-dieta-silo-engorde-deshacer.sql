-- Deshacer del 307: borra SÓLO los 3 renglones que creó (marcados [script 307]).
delete from productivo.actividad_insumos where notas like '[script 307]%';
delete from public.presupuesto_variables where fundamento like '[script 307]%';
