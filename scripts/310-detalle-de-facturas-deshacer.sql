-- [script 310] DESHACER — las dos tablas las creó el 310 (no existían): se borran con lo que tengan, y su mapeo de permisos.
begin;
delete from public.recurso_tablas where schema_nombre = 'public' and tabla in ('factura_lecturas','factura_renglones') and motivo like '[script 310]%';
drop table if exists public.factura_renglones;
drop table if exists public.factura_lecturas;
commit;
