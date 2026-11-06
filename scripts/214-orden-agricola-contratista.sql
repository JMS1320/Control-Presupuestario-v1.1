-- Script 214 (A-FEAT-1556, 06/11 — JMS 05/11: «un contratista por ORDEN»): el contratista de la orden agrícola, por CUIT
-- (como el maestro public.proveedores) para que después su factura de ARCA se ate a sus órdenes. Vacías al crear.
-- Deshacer: scripts/214-orden-agricola-contratista-deshacer.sql (las columnas no existían: se verifica antes).
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'productivo' and table_name = 'ordenes_agricolas'
             and column_name in ('contratista_cuit', 'contratista_nombre'))
    then raise exception 'ya existe contratista_cuit o contratista_nombre: no se corre'; end if;
end $$;
alter table productivo.ordenes_agricolas add column contratista_cuit varchar(13), add column contratista_nombre text;
comment on column productivo.ordenes_agricolas.contratista_cuit is '[script 214] CUIT del contratista que hace la orden (A-FEAT-1556)';
comment on column productivo.ordenes_agricolas.contratista_nombre is '[script 214] Nombre del contratista, como en public.proveedores';
