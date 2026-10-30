-- Deshace 142 · vuelve las 2 tablas de mails a como las dejó el 140 (recurso `egresos`, sin restringir la lectura).
-- Sólo toca las filas marcadas '[script 142]'; les devuelve el motivo original (lo que sigue a «Antes: »).
begin;
update public.recurso_tablas
   set recurso = 'egresos', restringe_lectura = false,
       motivo = substring(motivo from position('Antes: ' in motivo) + 7)
 where schema_nombre = 'public' and tabla in ('mails_registro','mails_reglas') and motivo like '[script 142]%';
commit;
