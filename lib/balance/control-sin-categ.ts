/**
 * 🏷️ **MOVIMIENTOS CONCILIADOS SIN CATEGORÍA — alerta del balance** (A-FEAT-1496, tarea de JMS 01/11: *«debe haber
 * alerta de pendiente de balance si hay cosa sin categ en el período (en el extracto)»*).
 *
 * Un movimiento sin conciliar ya es un tema de conciliación. Pero uno CONCILIADO sin categoría no aparecía en ningún
 * lado, y en el balance cae en ninguna cuenta. Pasó con el echeq 102 (el motor lo concilió y no le puso la categoría de
 * su factura, A-BUG-1495). Este control lo deja a la vista en ⛔ Errores, un tema por cuenta, con cada movimiento y su
 * link, y lo que tiene vinculado (factura, cuota, sueldo) para saber de dónde sacar la categoría.
 */
import { CUENTAS_CONCILIABLES } from "@/lib/conciliacion/propuestas-ejercicio"
import { linkExtracto, rangoQueContiene } from "@/lib/extracto/link"
import type { Tema } from "./recorrido"

const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export interface MovSinCateg { id: string; fecha: string; importe: number; signo: "−" | "+"; descripcion: string; vinculo: string | null }

/** Pura: un tema por cuenta con los movimientos conciliados sin categoría. */
export function temasSinCateg(porCuenta: { cuentaId: string; nombre: string; movs: MovSinCateg[] }[]): Tema[] {
  return porCuenta.filter(c => c.movs.length).map((c): Tema => {
    const r = rangoQueContiene(c.movs.map(m => m.fecha))
    const total = c.movs.reduce((a, m) => a + m.importe, 0)
    return {
      clave: `ctl:sin-categ:${c.cuentaId}`, grupo: "error", etiqueta: "Conciliado sin categoría", importe: total, cuenta: { id: c.cuentaId, nombre: c.nombre },
      titulo: `${c.nombre}: ${c.movs.length} movimiento(s) conciliado(s) sin categoría (${plata(total)})`,
      papel: "Control: conciliados sin categoría",
      que: `Están conciliados pero sin categoría: en el balance no caen en ninguna cuenta.\n` + c.movs.map(m => `• ${dmy(m.fecha)} ${m.signo}${plata(m.importe)} «${m.descripcion}»${m.vinculo ? ` — vinculado a ${m.vinculo}` : " — sin vínculo"}`).join("\n"),
      propuesta: "Completar la categoría con la de lo que tiene vinculado (la cuenta de la factura, del template o del sueldo); si no tiene vínculo, decime cuál va («Aplicá vos»).",
      links: [{ texto: `Los ${c.movs.length} movimientos en ${c.nombre}`, href: linkExtracto({ cuenta: c.cuentaId, movs: c.movs.map(m => m.id), desde: r.desde, hasta: r.hasta }) }],
      respondido: false,
    }
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any

/** Lee, por cada cuenta de la empresa, los conciliados del ejercicio sin categoría. Nunca tira. */
export async function leerTemasSinCateg(sb: Cliente, empresa: string, desde: string, hasta: string): Promise<{ temas: Tema[]; error: string | null }> {
  const porCuenta: { cuentaId: string; nombre: string; movs: MovSinCateg[] }[] = []
  const errores: string[] = []
  for (const c of CUENTAS_CONCILIABLES.filter(x => x.empresa === empresa)) {
    try {
      const esTarjeta = /tarjeta/.test(c.tabla)
      const base = c.schema === "public" ? sb.from(c.tabla) : sb.schema(c.schema).from(c.tabla)
      let q = base.select("*").gte("fecha", desde).lte("fecha", hasta).eq("estado", "conciliado").or("categ.is.null,categ.eq.").limit(500)
      if (esTarjeta) q = q.eq("tipo_fila", "movimiento")
      const { data, error } = await q
      if (error) throw new Error(error.message)
      porCuenta.push({ cuentaId: c.cuentaId, nombre: c.nombre, movs: (data ?? []).map((m: Record<string, unknown>) => {
        const deb = Number(m.debitos) || 0
        const vinc = m.comprobante_arca_id ? "una factura" : m.template_cuota_id ? "una cuota de template" : m.sueldo_pago_id ? "un pago de sueldo" : m.anticipo_id ? "un anticipo" : m.comprobante_venta_id ? "una venta" : null
        return { id: String(m.id), fecha: String(m.fecha), importe: deb > 0 ? deb : Number(m.creditos) || 0, signo: deb > 0 ? "−" : "+", descripcion: String(m.descripcion ?? ""), vinculo: vinc }
      }) })
    } catch (e) { errores.push(`${c.nombre}: ${(e as Error).message}`) }
  }
  return { temas: temasSinCateg(porCuenta), error: errores.length ? errores.join(" · ") : null }
}
