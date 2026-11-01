-- Deshace el script 166: borra sólo la fila que creó (marca [script 166]).
delete from public.archivo_destinos where clave = 'sueldos_legajos' and nota like '[script 166]%';
