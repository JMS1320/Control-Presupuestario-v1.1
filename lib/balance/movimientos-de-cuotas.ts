/**
 * 🏦 **EL BANCO DE CADA CUOTA DE TEMPLATE** — A-FEAT-1515 (JMS 01/11, libro H).
 *
 * JMS: *«el primer usuario del reporte soy yo, que lo tengo que auditar… como se da en el extracto: la fecha, el monto, el
 * comprobante, el proveedor y el detalle»*. Para eso cada cuota necesita su lado del banco: **en qué cuenta se pagó, con qué
 * comprobante, y cuánto de ella respalda el movimiento** — eso último es el control contra el banco de cada solapa (§ 🧮: el
 * mismo número por dos caminos; el banco es una fuente independiente de las cuotas).
 *
 * | Vínculo | Cómo se resuelve |
 * |---|---|
 * | el movimiento apunta a la CUOTA (`template_cuota_id` = id de la cuota) | respalda lo que suma el movimiento (débito − crédito) |
 * | el movimiento apunta al GRUPO (`template_cuota_id` = `grupo_pago_id`: varias cuotas pagadas juntas) | si el grupo entero suma lo que pagó el banco, cada cuota está respaldada por su monto; si no, se reparte en proporción y se dice |
 * | ningún movimiento, y la cuota dice «conciliado» | no hay respaldo: se lista |
 * | la cuenta está en dólares | no se compara (la cuota está en pesos): se lista |
 *
 * Las tablas son las de `TABLAS_CON_VINCULO_ARCA` — todas llevan también `template_cuota_id` (leído de la base el 01/11).
 */
import type { ClienteMinimo } from "./fechas-de-pago"
import type { CuotaTemplate, BancoDeCuota } from "./templates-libro"
import { TABLAS_CON_VINCULO_ARCA, type TablaConVinculoArca } from "@/lib/conciliacion/tablas-con-vinculo-arca"

export interface MovimientoDeCuota {
  /** A qué apunta: el id de la cuota o el de su grupo de pago. */
  vinculo: string
  cuenta: string
  fecha: string
  comprobante: string
  debitos: number
  creditos: number
  enDolares: boolean
}

export interface MovimientosDeCuotas {
  movimientos: MovimientoDeCuota[]
  /** Tablas que no se pudieron leer: se muestran (un vínculo no mirado parece un vínculo que no existe). */
  tablasQueFallaron: string[]
}

const r2 = (n: number) => Math.round(n * 100) / 100
const TANDA = 300
const nombreCuenta = (t: TablaConVinculoArca) => t.cuenta ?? `${t.schema}.${t.tabla}`

/** Lee los movimientos que apuntan a estas cuotas o a sus grupos de pago, en todas las cuentas. */
export async function leerMovimientosDeCuotas(cliente: ClienteMinimo, cuotas: CuotaTemplate[]): Promise<MovimientosDeCuotas> {
  const ids = [...new Set(cuotas.flatMap(c => [c.id, c.grupoPagoId]).filter((x): x is string => !!x))]
  const movimientos: MovimientoDeCuota[] = []
  const tablasQueFallaron: string[] = []
  if (!ids.length) return { movimientos, tablasQueFallaron }
  for (const t of TABLAS_CON_VINCULO_ARCA) {
    const esTarjeta = /tarjeta/.test(t.tabla)
    for (let i = 0; i < ids.length; i += TANDA) {
      const q = t.schema === "public" ? cliente.from(t.tabla) : cliente.schema(t.schema).from(t.tabla)
      const { data, error } = await q
        .select(`template_cuota_id, fecha, debitos, creditos, numero_de_comprobante${esTarjeta ? ", comprobante" : ""}`)
        .in("template_cuota_id", ids.slice(i, i + TANDA))
      if (error) { if (!tablasQueFallaron.includes(nombreCuenta(t))) tablasQueFallaron.push(nombreCuenta(t)); continue }
      for (const m of (data ?? []) as Array<Record<string, unknown>>) {
        movimientos.push({
          vinculo: String(m.template_cuota_id),
          cuenta: nombreCuenta(t),
          fecha: String(m.fecha ?? "").slice(0, 10),
          comprobante: String((esTarjeta ? m.comprobante || m.numero_de_comprobante : m.numero_de_comprobante) ?? "").trim(),
          debitos: Number(m.debitos) || 0,
          creditos: Number(m.creditos) || 0,
          enDolares: !!t.enDolares,
        })
      }
    }
  }
  return { movimientos, tablasQueFallaron }
}

/**
 * Pura. Le pone a cada cuota su lado del banco. `todas` son TODAS las cuotas leídas (para el total de un grupo de pago, que
 * puede tener cuotas en otras solapas o en otro ejercicio). Devuelve cuotas nuevas: no toca las que recibe.
 */
export function vincularBanco(cuotas: CuotaTemplate[], todas: CuotaTemplate[], movs: MovimientoDeCuota[]): CuotaTemplate[] {
  const porVinculo = new Map<string, MovimientoDeCuota[]>()
  for (const m of movs) porVinculo.set(m.vinculo, [...(porVinculo.get(m.vinculo) ?? []), m])
  const totalGrupo = new Map<string, { total: number; n: number }>()
  for (const c of todas) if (c.grupoPagoId) {
    const g = totalGrupo.get(c.grupoPagoId) ?? { total: 0, n: 0 }
    totalGrupo.set(c.grupoPagoId, { total: r2(g.total + c.monto), n: g.n + 1 })
  }
  return cuotas.map(c => ({ ...c, banco: bancoDe(c, porVinculo, totalGrupo) }))
}

/** El motivo de las conciliadas en $ 0 sin movimiento: van al final de la lista de casos. */
export const MOTIVO_EN_CERO = "conciliada en $ 0, sin movimiento (no mueve plata)"

const unicos = (xs: string[]) => [...new Set(xs.filter(Boolean))].join(" + ")
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function bancoDe(c: CuotaTemplate, porVinculo: Map<string, MovimientoDeCuota[]>, totalGrupo: Map<string, { total: number; n: number }>): BancoDeCuota {
  const conciliada = /conciliad/i.test(c.estado)
  const propios = porVinculo.get(c.id) ?? []
  const delGrupo = c.grupoPagoId ? porVinculo.get(c.grupoPagoId) ?? [] : []
  const ms = propios.length ? propios : delGrupo
  const cuenta = unicos(ms.map(m => m.cuenta))
  const comprobante = unicos(ms.map(m => m.comprobante))
  if (!ms.length) {
    if (!conciliada) return { cuenta: "", comprobante: "", respaldo: null, motivo: null }
    // 01/11: 85 de las 87 conciliadas sin movimiento están en $ 0 (SICORE sin retenciones, retiros semestrales…): no mueven
    // plata y no cambian el control, pero se dicen aparte para que no tapen a las que sí (A-BUG-1517).
    return Math.abs(c.monto) < 0.005
      ? { cuenta: "", comprobante: "", respaldo: 0, motivo: MOTIVO_EN_CERO }
      : { cuenta: "", comprobante: "", respaldo: null, motivo: "conciliada sin movimiento en el banco" }
  }
  if (ms.some(m => m.enDolares)) return { cuenta, comprobante, respaldo: null, motivo: "pagada desde una cuenta en dólares: no se compara con la cuota en pesos" }
  const neto = r2(ms.reduce((t, m) => t + m.debitos - m.creditos, 0))
  if (propios.length) {
    return { cuenta, comprobante, respaldo: neto, motivo: Math.abs(neto - c.monto) > 0.01 ? `el banco movió $ ${fmt(neto)} y la cuota dice $ ${fmt(c.monto)}` : null }
  }
  const g = totalGrupo.get(c.grupoPagoId!) ?? { total: c.monto, n: 1 }
  if (Math.abs(neto - g.total) <= 0.01) return { cuenta, comprobante, respaldo: c.monto, motivo: null }
  const respaldo = g.total ? r2(c.monto * neto / g.total) : 0
  return { cuenta, comprobante, respaldo, motivo: `pago agrupado de ${g.n} cuotas por $ ${fmt(g.total)}; el banco movió $ ${fmt(neto)}` }
}
