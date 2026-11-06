/**
 * 🛒 A-FEAT-1557 etapa 2 — las COMPRAS SIN FACTURA en el Cash Flow (JMS 06/11: *«cuenta en el Cash Flow desde que se carga;
 * se reemplaza con los datos de la factura… ahí nace todo»*).
 *
 * Una compra (renglones de `productivo.movimientos_insumos` con el mismo `compra_id`) es un egreso a su **fecha de pago
 * pactada** mientras no tenga factura. Los renglones que ya están atados a una factura (`productivo.entrega_factura`) salen:
 * desde ahí cuenta la factura, y contar los dos sería contar la plata dos veces. Sólo las compras cargadas como primer
 * registro (con `compra_id`): las viejas eran la entrega de algo ya facturado o por facturar, y no tienen fecha de pago.
 * Pura; caso en `npm run probar`.
 */

export interface MovCompra {
  id: string
  compra_id: string | null
  fecha: string
  fecha_pago: string | null
  empresa: string | null
  proveedor: string | null
  cuit: string | null
  cantidad: number | null
  costo_unitario: number | null
  producto?: string | null
  unidad?: string | null
}

export interface FilaCompraSinFactura {
  compra_id: string
  fecha_pago: string
  empresa: string | null
  proveedor: string
  cuit: string
  monto: number
  /** Renglones sin precio: la compra cuenta con lo que se sabe, y se avisa que falta. */
  sinPrecio: number
  detalle: string
  ids: string[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function comprasSinFactura(movs: MovCompra[], conFactura: Set<string>): FilaCompraSinFactura[] {
  const grupos = new Map<string, MovCompra[]>()
  for (const m of movs) {
    if (!m.compra_id || conFactura.has(m.id)) continue
    grupos.set(m.compra_id, [...(grupos.get(m.compra_id) ?? []), m])
  }
  return [...grupos.entries()].map(([compra_id, rs]) => {
    const p = rs[0]
    const conPrecio = rs.filter(r => Number(r.costo_unitario) > 0)
    const monto = r2(conPrecio.reduce((s, r) => s + (Number(r.cantidad) || 0) * Number(r.costo_unitario), 0))
    const items = rs.map(r => `${r.producto ?? "insumo"} ${(Number(r.cantidad) || 0).toLocaleString("es-AR", { maximumFractionDigits: 3 })}${r.unidad ? " " + r.unidad : ""}`)
    const sinPrecio = rs.length - conPrecio.length
    return {
      compra_id, fecha_pago: p.fecha_pago || p.fecha, empresa: p.empresa, proveedor: p.proveedor || "", cuit: p.cuit || "",
      monto, sinPrecio,
      detalle: `Compra sin factura: ${items.join(", ")}${sinPrecio ? ` (⚠️ ${sinPrecio} sin precio)` : ""}`,
      ids: rs.map(r => r.id),
    }
  }).sort((a, b) => a.fecha_pago.localeCompare(b.fecha_pago))
}
