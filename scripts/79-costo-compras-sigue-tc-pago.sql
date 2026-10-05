-- 79 · El costo de las compras en dólares SIGUE AL TC DEL PAGO — A-FEAT-1255 (2026-10-05)
--
-- Criterio del usuario: «lo real es lo que se pagó». El costo del insumo (stock, consumo, margen,
-- presupuesto) va al TC del PAGO; la factura (subdiario, IVA) sigue con su TC hasta que llegue la NC.
-- Mientras no se pagó, el de la factura.
--
-- Por qué un TRIGGER y no código: `tc_pago` se escribe desde 6 lugares (Cash Flow, Egresos, vinculación
-- de anticipos ×2, resetear factura, resetear retención). Un arreglo en el código habría cubierto uno
-- de seis — el modo de falla de este proyecto (§ 🔁 propagación del dato). Y al DESHACER (tc_pago → NULL)
-- vuelve solo al TC de la factura.
--
-- Qué toca, sólo para las compras vinculadas a ESA factura y cargadas en USD con su precio original:
--   · stock_insumos.costo_unitario   — sólo si era el de esta compra (no pisa un costo cargado a mano)
--   · movimientos_insumos            — tipo_cambio, costo_unitario y monto_total en pesos
--   · entrega_factura.precio_unitario — el vínculo, en pesos (lo lee el consumo)

create or replace function productivo.costo_compras_sigue_tc()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tc numeric;
begin
  if new.moneda is null or new.moneda in ('PES', 'ARS') then return new; end if;
  if new.tc_pago is not distinct from old.tc_pago and new.tipo_cambio is not distinct from old.tipo_cambio then return new; end if;
  v_tc := coalesce(new.tc_pago, new.tipo_cambio);
  if v_tc is null or v_tc <= 0 then return new; end if;

  update productivo.stock_insumos s
     set costo_unitario = round(m.costo_unitario_moneda * v_tc, 2)
    from productivo.movimientos_insumos m
    join productivo.entrega_factura ef on ef.movimiento_id = m.id
   where ef.factura_id = new.id and coalesce(ef.origen, 'arca') = 'arca'
     and m.moneda = 'USD' and m.costo_unitario_moneda is not null
     and s.id = m.insumo_stock_id and s.costo_unitario = m.costo_unitario;

  update productivo.movimientos_insumos m
     set tipo_cambio = v_tc,
         costo_unitario = round(m.costo_unitario_moneda * v_tc, 2),
         monto_total = round(m.cantidad * m.costo_unitario_moneda * v_tc, 2)
    from productivo.entrega_factura ef
   where ef.movimiento_id = m.id and ef.factura_id = new.id and coalesce(ef.origen, 'arca') = 'arca'
     and m.moneda = 'USD' and m.costo_unitario_moneda is not null;

  update productivo.entrega_factura ef
     set precio_unitario = round(m.costo_unitario_moneda * v_tc, 4)
    from productivo.movimientos_insumos m
   where ef.movimiento_id = m.id and ef.factura_id = new.id and coalesce(ef.origen, 'arca') = 'arca'
     and m.moneda = 'USD' and m.costo_unitario_moneda is not null;

  return new;
end $$;

drop trigger if exists trg_costo_compras_sigue_tc on msa.comprobantes_arca;
create trigger trg_costo_compras_sigue_tc
  after update of tc_pago, tipo_cambio on msa.comprobantes_arca
  for each row execute function productivo.costo_compras_sigue_tc();
