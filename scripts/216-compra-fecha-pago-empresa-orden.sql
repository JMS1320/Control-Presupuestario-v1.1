-- Script 216 (A-FEAT-1557 etapa 1, 06/11 — JMS: «la compra… ahí nace todo y debe continuar»).
-- La compra ya es un movimiento de stock (productivo.movimientos_insumos, tipo 'compra'). Se le suma lo que le falta para ser
-- el PRIMER registro: compra_id (agrupa los renglones de una compra), fecha_pago (la pactada: etapa 2 la lleva al Cash Flow),
-- empresa (quién paga) y orden_agricola_id (la orden de la que salió). Vacías en lo existente.
-- Deshacer: scripts/216-compra-fecha-pago-empresa-orden-deshacer.sql (las columnas no existían: se verifica antes).
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'productivo' and table_name = 'movimientos_insumos'
             and column_name in ('compra_id', 'fecha_pago', 'empresa', 'orden_agricola_id'))
    then raise exception 'ya existe alguna de las columnas: no se corre'; end if;
end $$;
alter table productivo.movimientos_insumos
  add column compra_id uuid,
  add column fecha_pago date,
  add column empresa text,
  add column orden_agricola_id uuid references productivo.ordenes_agricolas(id) on delete set null;
comment on column productivo.movimientos_insumos.compra_id is '[script 216] agrupa los renglones de UNA compra (A-FEAT-1557)';
comment on column productivo.movimientos_insumos.fecha_pago is '[script 216] fecha de pago pactada de la compra (A-FEAT-1557)';
comment on column productivo.movimientos_insumos.empresa is '[script 216] quién paga la compra: MSA / PAM / MA (A-FEAT-1557)';
comment on column productivo.movimientos_insumos.orden_agricola_id is '[script 216] la orden agrícola de la que salió la compra (A-FEAT-1557)';
