/**
 * ✨ Lee de la base todo lo que hace falta para vincular una factura con sus entradas al stock, renglón por renglón, y arma las
 * propuestas (A-FEAT-1663 stock paso 1). Sólo LEE. La usan la ruta `/api/facturas/vincular-stock` y los controles de sólo lectura.
 */
import { proponerPorRenglon, normalizarDescripcion, VENTANA_ANTES, VENTANA_DESPUES, type EntradaLibre, type RenglonFactura } from "./vinculo-renglon"

export const schemaDe = (e: string) => (e === "PAM" ? "pam" : e === "MA" ? "ma" : "msa")
const sumar = (f: string, d: number) => { const x = new Date(f + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10) }

export async function cargarVinculoStock(sb: any, empresa: string, id: string) {
  const { data: f } = await sb.schema(schemaDe(empresa)).from("comprobantes_arca")
    .select("id, fecha_emision, cuit, denominacion_emisor, moneda, tipo_cambio, punto_venta, numero_desde").eq("id", id).maybeSingle()
  if (!f) return null
  const prod = sb.schema("productivo")
  const [{ data: lect }, { data: rens }, { data: insumos }, { data: movs }, { data: vincs }, { data: aprendRaw }] = await Promise.all([
    sb.from("factura_lecturas").select("estado, tipo_cambio, moneda").eq("empresa", empresa).eq("comprobante_id", id).maybeSingle(),
    sb.from("factura_renglones").select("id, n, descripcion, cantidad, unidad, neto, insumo_stock_id, no_vincular_solo").eq("empresa", empresa).eq("comprobante_id", id).order("n"),
    prod.from("stock_insumos").select("id, producto, unidad_medida"),
    prod.from("movimientos_insumos").select("id, fecha, insumo_stock_id, cantidad, costo_unitario, proveedor, cuit")
      .eq("tipo", "compra").gte("fecha", sumar(f.fecha_emision, -VENTANA_ANTES)).lte("fecha", sumar(f.fecha_emision, VENTANA_DESPUES)),
    prod.from("entrega_factura").select("id, movimiento_id, factura_id, cantidad, precio_unitario, notas, renglon_n, automatico, antes, revisado_at, revisado_por, movimiento:movimientos_insumos(fecha, cantidad, insumo_stock_id, stock_insumos(producto, unidad_medida))"),
    sb.from("factura_renglones").select("comprobante_id, descripcion, insumo_stock_id").eq("empresa", empresa).not("insumo_stock_id", "is", null),
  ])
  const conFactura = new Set((vincs || []).map((v: any) => v.movimiento_id))
  const entradas: EntradaLibre[] = (movs || []).filter((m: any) => !conFactura.has(m.id)).map((m: any) => ({
    id: m.id, fecha: m.fecha, insumoStockId: m.insumo_stock_id, cantidad: Number(m.cantidad) || 0,
    costoUnitario: m.costo_unitario == null ? null : Number(m.costo_unitario), proveedor: m.proveedor, cuit: m.cuit,
  }))
  const idsAp = [...new Set((aprendRaw || []).map((a: any) => a.comprobante_id))]
  const { data: cuits } = idsAp.length ? await sb.schema(schemaDe(empresa)).from("comprobantes_arca").select("id, cuit").in("id", idsAp) : { data: [] }
  const cuitDe = new Map((cuits || []).map((c: any) => [c.id, String(c.cuit || "")]))
  const aprendidos = (aprendRaw || []).filter((a: any) => a.comprobante_id !== id)
    .map((a: any) => ({ cuit: cuitDe.get(a.comprobante_id) || "", descripcion: normalizarDescripcion(a.descripcion), insumoStockId: a.insumo_stock_id }))
  const vinculos = (vincs || []).filter((v: any) => v.factura_id === id)
  const renglones: RenglonFactura[] = (rens || []).map((r: any) => ({
    n: r.n, descripcion: r.descripcion, cantidad: r.cantidad == null ? null : Number(r.cantidad), unidad: r.unidad,
    neto: r.neto == null ? null : Number(r.neto), insumoStockId: r.insumo_stock_id, noVincularSolo: !!r.no_vincular_solo,
  }))
  const moneda = lect?.moneda || (!f.moneda || f.moneda === "PES" ? "ARS" : f.moneda)
  const tipoCambio = Number(lect?.tipo_cambio) || Number(f.tipo_cambio) || null
  // Los renglones que ya tienen su vínculo (por número, o uno viejo sin número del mismo insumo) no se proponen otra vez.
  const vinculado = (r: RenglonFactura) => vinculos.some((v: any) => v.renglon_n === r.n ||
    (v.renglon_n == null && r.insumoStockId && v.movimiento?.insumo_stock_id === r.insumoStockId))
  const pendientes = renglones.filter(r => !vinculado(r))
  const propuestas = proponerPorRenglon({
    factura: { fecha: f.fecha_emision, cuit: f.cuit, proveedor: f.denominacion_emisor || "", moneda, tipoCambio, estadoLectura: lect?.estado ?? null },
    renglones: pendientes, entradas, aprendidos,
    insumos: (insumos || []).map((i: any) => ({ id: i.id, producto: i.producto, unidad: i.unidad_medida })),
  })
  const numero = `${String(f.punto_venta ?? "").padStart(4, "0")}-${String(f.numero_desde ?? "").padStart(8, "0")}`
  return { f, numero, moneda, tipoCambio, renglones, propuestas, vinculos, entradas, insumos: insumos || [] }
}
export type CtxVinculoStock = NonNullable<Awaited<ReturnType<typeof cargarVinculoStock>>>

