-- Deshace el 274: borra SÓLO la fila que creó (antes no había ninguna fila del papel «granos.certificaciones»).
begin;
delete from public.balance_datos_usuario where papel = 'granos.certificaciones' and clave = '98cad2ef-cc4d-4574-963b-081c639bd3db' and actualizado_por like '[script 274]%';
commit;
