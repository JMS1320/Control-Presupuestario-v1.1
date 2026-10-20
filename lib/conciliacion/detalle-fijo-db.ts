/**
 * 🏷️ A-FEAT-1296 — la parte que toca la base del detalle fijo. Un solo lugar para el motor y para el
 * Asignar a mano (§ ♻️ Centralizar), así los dos caminos ponen el mismo detalle.
 */
import { elegirDetalleFijo, admiteDetalleFijo, type DetalleFijo } from "@/lib/conciliacion/detalle-fijo"

type Cliente = { from: (t: string) => any; schema: (s: string) => any }

/** Los fijos activos. Si la tabla todavía no existe (script 88 sin correr) devuelve [] y la conciliación sigue igual. */
export async function cargarDetallesFijos(cliente: Cliente): Promise<DetalleFijo[]> {
  const { data, error } = await cliente.from("detalles_por_proveedor")
    .select("id, cuit, detalle, monto_referencia, activo").eq("activo", true)
  if (error) { console.warn("Detalle fijo no disponible:", error.message); return [] }
  return (data || []).map((f: any) => ({ ...f, monto_referencia: f.monto_referencia == null ? null : Number(f.monto_referencia) }))
}

/**
 * Elige el detalle fijo de la factura y, si corresponde, lo deja también EN LA FACTURA (el detalle es un dato
 * multivista: Cash Flow, subdiario, extracto) y actualiza el monto de referencia con el de esta vez.
 * Devuelve el detalle a poner en el movimiento, o null si no aplica (o si hay que elegir entre varios).
 */
export async function aplicarDetalleFijo(cliente: Cliente, fijos: DetalleFijo[], f: {
  facturaId: string
  /** `msa.comprobantes_arca` (como `origen_tabla` del Cash Flow) o sólo el schema */
  tabla: string
  cuit: string | null | undefined
  monto: number
  detalleFactura: string | null | undefined
  emisor?: string | null
  numero?: string | number | null
}): Promise<string | null> {
  const { elegido } = elegirDetalleFijo(fijos, f.cuit, f.monto)
  if (!elegido) return null
  const schema = f.tabla.split(".")[0]
  if (admiteDetalleFijo(f.detalleFactura, f.emisor, f.numero)) {
    const { error } = await cliente.schema(schema).from("comprobantes_arca").update({ detalle: elegido.detalle }).eq("id", f.facturaId)
    if (error) console.warn("No se pudo dejar el detalle fijo en la factura:", error.message)
  }
  if (f.monto > 0) {
    await cliente.from("detalles_por_proveedor").update({ monto_referencia: f.monto, updated_at: new Date().toISOString() }).eq("id", elegido.id)
  }
  return elegido.detalle
}

/**
 * El tilde «Usar siempre para este proveedor»: guarda (o reactiva) el renglón con el monto de esta factura.
 * Mismo CUIT y mismo texto (sin importar mayúsculas) = el mismo renglón.
 */
export async function marcarDetalleFijo(cliente: Cliente, cuit: string, detalle: string, monto: number): Promise<string | null> {
  const c = String(cuit).replace(/\D/g, "")
  const d = detalle.trim()
  if (!c || !d) return "Falta el CUIT del proveedor o el detalle"
  const { data: existentes, error: e1 } = await cliente.from("detalles_por_proveedor").select("id, detalle").eq("cuit", c)
  if (e1) return e1.message
  const mismo = (existentes || []).find((x: any) => String(x.detalle).trim().toLowerCase() === d.toLowerCase())
  const fila = { detalle: d, monto_referencia: monto > 0 ? monto : null, activo: true, updated_at: new Date().toISOString() }
  const { error } = mismo
    ? await cliente.from("detalles_por_proveedor").update(fila).eq("id", mismo.id)
    : await cliente.from("detalles_por_proveedor").insert({ cuit: c, ...fila })
  return error ? error.message : null
}
