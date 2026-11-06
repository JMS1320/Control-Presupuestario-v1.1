-- Deshace 220: vuelve las marcas de 217/218/219 a 212/213/214 (sólo el prefijo; ningún valor).
begin;
update public.documentos_respaldo set creado_por = '[script 212]' || substr(creado_por, 13) where creado_por like '[script 217]%';
update public.documentos_respaldo set creado_por = '[script 214]' || substr(creado_por, 13) where creado_por like '[script 219]%';
update public.balance_datos_usuario set actualizado_por = '[script 213]' || substr(actualizado_por, 13)
  where empresa='MSA' and anio_cierre=2026 and papel='granos' and actualizado_por like '[script 218]%';
commit;
