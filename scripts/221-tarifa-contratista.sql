-- Script 221 (A-FEAT-1557 etapa 4 / A-FEAT-1556, 06/11 — JMS: «convertir la tarifa en pesos de cada contratista a su
-- equivalente en los otros índices para poder comparar»; «puede crear columnas, con aviso a Javier»).
-- Cada labor de una orden agrícola lleva su TARIFA PACTADA (valor + unidad) y la orden, la FACTURA del contratista que la cobra.
-- Vacías en lo existente. Deshacer: scripts/221-tarifa-contratista-deshacer.sql (las columnas no existían: se verifica antes).
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'productivo'
             and ((table_name = 'lineas_orden_agricola_labores' and column_name in ('tarifa', 'tarifa_unidad'))
               or (table_name = 'ordenes_agricolas' and column_name in ('factura_contratista_id', 'factura_contratista_empresa'))))
    then raise exception 'ya existe alguna de las columnas: no se corre'; end if;
end $$;
alter table productivo.lineas_orden_agricola_labores
  add column tarifa numeric,
  add column tarifa_unidad text check (tarifa_unidad in ('ars_ha', 'usd_ha', 'kg_soja_ha', 'l_gasoil_ha', 'pct_cosecha'));
alter table productivo.ordenes_agricolas
  add column factura_contratista_id uuid,
  add column factura_contratista_empresa text;
comment on column productivo.lineas_orden_agricola_labores.tarifa is '[script 221] tarifa pactada con el contratista para esta labor, en tarifa_unidad (A-FEAT-1557 etapa 4)';
comment on column productivo.lineas_orden_agricola_labores.tarifa_unidad is '[script 221] ars_ha · usd_ha · kg_soja_ha · l_gasoil_ha · pct_cosecha (A-FEAT-1557 etapa 4)';
comment on column productivo.ordenes_agricolas.factura_contratista_id is '[script 221] la factura del contratista (comprobantes_arca de factura_contratista_empresa) que cobra esta orden (A-FEAT-1557 etapa 4)';
comment on column productivo.ordenes_agricolas.factura_contratista_empresa is '[script 221] MSA / PAM / MA: schema de la factura del contratista (A-FEAT-1557 etapa 4)';
