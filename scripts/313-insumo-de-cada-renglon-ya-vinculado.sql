-- [script 313] DATOS (capa nueva) — qué insumo del stock es cada renglón de las facturas YA vinculadas (A-FEAT-1663 stock paso 1).
-- Es lo que la app «aprende» para vincular sola la próxima factura del mismo artículo y proveedor (Longo «Maíz quebrado» → Maíz Granel…).
-- Sólo toca columnas de la capa nueva: factura_renglones.insumo_stock_id (de script 310/311) y entrega_factura.renglon_n (de script 312).
-- Antes de correr: las dos estaban vacías en todas las filas (verificado 27/11: 0 y 0). No cambia kilos, precios ni stock.
-- Deshacer: scripts/313-insumo-de-cada-renglon-ya-vinculado-deshacer.sql (vuelve a null exactamente las filas de este script).
begin;
-- 1) Facturas de UN renglón con sus entradas vinculadas, todas del mismo insumo: el renglón es ese insumo y los vínculos son del renglón 1.
with una as (
  select r.id ren_id, r.comprobante_id, min(m.insumo_stock_id::text)::uuid insumo
    from public.factura_renglones r
    join productivo.entrega_factura e on e.factura_id = r.comprobante_id
    join productivo.movimientos_insumos m on m.id = e.movimiento_id
   where r.empresa = 'MSA' and (select count(*) from public.factura_renglones x where x.empresa = r.empresa and x.comprobante_id = r.comprobante_id) = 1
   group by r.id, r.comprobante_id having count(distinct m.insumo_stock_id) = 1
), u1 as (
  update public.factura_renglones r set insumo_stock_id = una.insumo from una where r.id = una.ren_id returning r.id
)
update productivo.entrega_factura e set renglon_n = 1 from una where e.factura_id = una.comprobante_id;

-- 2) Facturas de VARIOS renglones (Agro Centros 0003-00006447): cada renglón con el vínculo de su misma cantidad, si es uno solo.
with par as (
  select r.id ren_id, r.n, e.id vin_id, m.insumo_stock_id insumo,
         count(*) over (partition by r.id) nr, count(*) over (partition by e.id) ne
    from public.factura_renglones r
    join productivo.entrega_factura e on e.factura_id = r.comprobante_id and e.cantidad = r.cantidad
    join productivo.movimientos_insumos m on m.id = e.movimiento_id
   where r.empresa = 'MSA' and r.insumo_stock_id is null
), u2 as (
  update public.factura_renglones r set insumo_stock_id = par.insumo from par where r.id = par.ren_id and par.nr = 1 and par.ne = 1 returning r.id
)
update productivo.entrega_factura e set renglon_n = par.n from par where e.id = par.vin_id and par.nr = 1 and par.ne = 1;

-- 3) Los dos renglones de Paraquat de la 6447 (40 + 60 lt) son la misma entrada de 100 L: los dos son ese insumo (el vínculo queda sin número).
update public.factura_renglones r set insumo_stock_id = m.insumo_stock_id
  from productivo.entrega_factura e join productivo.movimientos_insumos m on m.id = e.movimiento_id
  join productivo.stock_insumos s on s.id = m.insumo_stock_id
 where e.factura_id = r.comprobante_id and r.insumo_stock_id is null and r.descripcion ilike '%paraquat%' and s.producto ilike '%paraquat%';
commit;

-- 4) (corrido aparte el mismo 27/11) Los renglones 1 (2 4 D, 60 lt) y 5 (S-Metolacloro, 40 lt) de la 6447 empataban en cantidad con los de Paraquat:
--    se resuelven por el nombre del insumo de su vínculo.
begin;
with f as (select id from msa.comprobantes_arca where numero_desde = 6447 and cuit = '33716360429'),
x as (select r.id ren_id, r.n, e.id vin_id, m.insumo_stock_id insumo from public.factura_renglones r join f on f.id = r.comprobante_id
  join productivo.entrega_factura e on e.factura_id = f.id join productivo.movimientos_insumos m on m.id = e.movimiento_id
  join productivo.stock_insumos s on s.id = m.insumo_stock_id
  where (r.n = 1 and s.producto ilike '24D%') or (r.n = 5 and s.producto ilike 'S-Metolacloro%')),
u as (update public.factura_renglones r set insumo_stock_id = x.insumo from x where r.id = x.ren_id returning r.id)
update productivo.entrega_factura e set renglon_n = x.n from x where e.id = x.vin_id;
commit;
-- Resultado verificado 27/11: 15 renglones con su insumo (todos los de facturas vinculadas) y 14 vínculos con su renglón
-- (el de Paraquat queda sin número: es una entrada de 100 L para dos renglones de 40 y 60).
