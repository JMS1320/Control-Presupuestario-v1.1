-- [script 309] Maíz de Longo: dos facturas sin compra / una compra sin factura (JMS 26/11, con OK: «revisar los datos y cargarlos bien»).
-- Verificado contra los PDF archivados de cada factura:
--   FC A 0002-00000531 (30/08/2026): Maíz quebrado 24,92 t × $ 270.500/t = $ 6.740.860,00 neto, IVA 21 %
--   FC A 0002-00000540 (06/10/2026): Maíz quebrado 25,56 t × $ 287.090/t = $ 7.338.020,40 neto, IVA 21 %
-- (1) La entrada del 29/08 (24.920 kg, sin precio) es la de la FC 531: se le pone el precio ($ 270,50/kg) y se vincula.
-- (2) La FC 540 no tenía compra: se carga la entrada (25.560 kg, $ 287,09/kg, 06/10) y se vincula; el stock suma 25.560 kg
--     como lo hace la app al registrar una compra (stock_insumos.cantidad += cantidad).
-- Deshacer: scripts/309-maiz-longo-fc531-fc540-deshacer.sql

begin;

-- (1)
update productivo.movimientos_insumos
   set costo_unitario = 270.50,
       observaciones = coalesce(observaciones || ' - ', '') || '[script 309] FC 0002-00000531: 24,92 t × $ 270.500/t'
 where id = '8f8ebbec-0d07-4a09-873e-d574353ab959' and costo_unitario is null and cantidad = 24920;

insert into productivo.entrega_factura (movimiento_id, factura_id, empresa, cantidad, precio_unitario, origen, notas)
select '8f8ebbec-0d07-4a09-873e-d574353ab959', '95e396aa-4066-4dd1-bbc4-07608dd63fb1', 'MSA', 24920, 270.50, 'arca', '[script 309] FC 531 ↔ entrada 29/08'
 where not exists (select 1 from productivo.entrega_factura where movimiento_id = '8f8ebbec-0d07-4a09-873e-d574353ab959' and factura_id = '95e396aa-4066-4dd1-bbc4-07608dd63fb1');

-- (2)
with nuevo as (
  insert into productivo.movimientos_insumos (fecha, insumo_stock_id, tipo, cantidad, costo_unitario, proveedor, cuit, moneda, empresa, observaciones)
  select '2026-10-06', '6a3c2042-5b75-4c2a-9962-3e6e62b87be4', 'compra', 25560, 287.09,
         'LONGO NESTOR LONGO SERGIO Y LONGO MARCELO SOC DE HECHO', '30628173563', 'ARS', 'MSA',
         '[script 309] FC 0002-00000540: 25,56 t × $ 287.090/t (fecha de entrada = la de la factura)'
   where not exists (select 1 from productivo.movimientos_insumos where observaciones like '[script 309]%' and fecha = '2026-10-06')
  returning id
)
insert into productivo.entrega_factura (movimiento_id, factura_id, empresa, cantidad, precio_unitario, origen, notas)
select id, 'e61ad731-9dfa-4ac9-a34a-235a8943a449', 'MSA', 25560, 287.09, 'arca', '[script 309] FC 540 ↔ entrada 06/10' from nuevo;

update productivo.stock_insumos set cantidad = cantidad + 25560, updated_at = now()
 where id = '6a3c2042-5b75-4c2a-9962-3e6e62b87be4'
   and exists (select 1 from productivo.movimientos_insumos where observaciones like '[script 309]%' and fecha = '2026-10-06' and created_at > now() - interval '1 minute');

commit;
